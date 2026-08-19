import { env } from "cloudflare:workers";
import { database } from "./couple-db";

type R2ObjectLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectLike | null>;
  put: (key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

type ReviewInput = {
  zooId: string;
  visitDate?: string;
  note?: string;
  scores: Record<string, number>;
  updatedAt?: string;
};

type MemoryInput = {
  id: string;
  zooId: string;
  date?: string;
  caption: string;
  note?: string;
  imageDataUrl?: string;
  createdAt?: string;
};

type CustomPlaceInput = Record<string, unknown> & { id: string };

type VisitInput = {
  zooId: string;
  date?: string;
  startPoint?: string;
  kilometers?: number;
  updatedAt?: string;
};

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value || "")) as T; } catch { return fallback; }
}

export function mediaBucket(): R2BucketLike {
  const bucket = (env as unknown as { MEDIA?: R2BucketLike }).MEDIA;
  if (!bucket) throw new Error("De foto-opslag is nog niet verbonden.");
  return bucket;
}

function memoryFromRow(row: Record<string, unknown>) {
  const updatedAt = String(row.updatedAt || row.createdAt || "");
  return {
    id: String(row.id),
    zooId: String(row.zooId),
    date: String(row.date || ""),
    caption: String(row.caption),
    note: String(row.note || ""),
    imageDataUrl: row.imageKey ? `/api/media?id=${encodeURIComponent(String(row.id))}&v=${encodeURIComponent(updatedAt)}` : undefined,
    createdAt: String(row.createdAt || ""),
  };
}

export async function journalState() {
  const db = database();
  const [placeRows, visitRows, reviewRows, memoryRows, customRows] = await Promise.all([
    db.prepare("SELECT zoo_id AS zooId, wished, visited FROM shared_place_states").all<Record<string, unknown>>(),
    db.prepare("SELECT zoo_id AS zooId, visit_date AS date, start_point AS startPoint, distance_km AS kilometers, updated_at AS updatedAt FROM shared_visits").all<Record<string, unknown>>(),
    db.prepare("SELECT zoo_id AS zooId, visit_date AS visitDate, note, scores_json AS scoresJson, updated_at AS updatedAt FROM shared_reviews").all<Record<string, unknown>>(),
    db.prepare("SELECT id, zoo_id AS zooId, visit_date AS date, caption, note, image_key AS imageKey, created_at AS createdAt, updated_at AS updatedAt FROM shared_memories ORDER BY created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT place_json AS placeJson FROM shared_custom_places ORDER BY created_at DESC").all<Record<string, unknown>>(),
  ]);
  const reviews = Object.fromEntries(reviewRows.results.map((row) => [String(row.zooId), {
    zooId: String(row.zooId), visitDate: String(row.visitDate || ""), note: String(row.note || ""),
    scores: parseJson<Record<string, number>>(row.scoresJson, {}), updatedAt: String(row.updatedAt || ""),
  }]));
  const visits = Object.fromEntries(visitRows.results.map((row) => [String(row.zooId), {
    zooId: String(row.zooId), date: String(row.date || ""), startPoint: String(row.startPoint || ""),
    kilometers: Math.max(0, Number(row.kilometers) || 0), updatedAt: String(row.updatedAt || ""),
  }]));
  const visitedIds = new Set(placeRows.results.filter((row) => Boolean(row.visited)).map((row) => String(row.zooId)));
  for (const row of visitRows.results) visitedIds.add(String(row.zooId));
  return {
    wishes: placeRows.results.filter((row) => Boolean(row.wished)).map((row) => String(row.zooId)),
    visitedIds: [...visitedIds],
    visits,
    reviews,
    memories: memoryRows.results.map(memoryFromRow),
    customPlaces: customRows.results.map((row) => parseJson<CustomPlaceInput | null>(row.placeJson, null)).filter(Boolean),
  };
}

export async function saveVisit(userId: string, input: VisitInput) {
  const zooId = clean(input.zooId, 160);
  const date = clean(input.date, 20);
  const startPoint = clean(input.startPoint, 240);
  const kilometers = Math.max(0, Math.min(100_000, Number(input.kilometers) || 0));
  if (!zooId || !date || !startPoint) throw new Error("Bezoekgegevens zijn niet compleet.");
  const db = database();
  await db.batch([
    db.prepare("INSERT INTO shared_visits (zoo_id, visit_date, start_point, distance_km, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET visit_date = excluded.visit_date, start_point = excluded.start_point, distance_km = excluded.distance_km, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP").bind(zooId, date, startPoint, kilometers, userId),
    db.prepare("INSERT INTO shared_place_states (zoo_id, wished, visited, updated_by_user_id, updated_at) VALUES (?, 0, 1, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET visited = 1, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP").bind(zooId, userId),
  ]);
}

export async function deleteVisit(userId: string, zooIdValue: unknown) {
  const zooId = clean(zooIdValue, 160);
  if (!zooId) throw new Error("Dierenplek ontbreekt.");
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM shared_visits WHERE zoo_id = ?").bind(zooId),
    db.prepare("INSERT INTO shared_place_states (zoo_id, wished, visited, updated_by_user_id, updated_at) VALUES (?, 0, 0, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET visited = 0, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP").bind(zooId, userId),
  ]);
}

export async function setPlaceState(userId: string, zooIdValue: unknown, values: { wished?: boolean; visited?: boolean }) {
  const zooId = clean(zooIdValue, 160);
  if (!zooId) throw new Error("Dierenplek ontbreekt.");
  const db = database();
  const current = await db.prepare("SELECT wished, visited FROM shared_place_states WHERE zoo_id = ?").bind(zooId).first<{ wished: number; visited: number }>();
  const wished = values.wished == null ? Boolean(current?.wished) : values.wished;
  const visited = values.visited == null ? Boolean(current?.visited) : values.visited;
  await db.prepare("INSERT INTO shared_place_states (zoo_id, wished, visited, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET wished = excluded.wished, visited = excluded.visited, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(zooId, wished ? 1 : 0, visited ? 1 : 0, userId).run();
}

export async function saveReview(userId: string, review: ReviewInput) {
  const zooId = clean(review.zooId, 160);
  if (!zooId || !review.scores || typeof review.scores !== "object") throw new Error("Beoordeling is niet compleet.");
  const scores = Object.fromEntries(Object.entries(review.scores).map(([key, value]) => [clean(key, 40), Math.max(0, Math.min(10, Number(value) || 0))]));
  await database().prepare("INSERT INTO shared_reviews (zoo_id, visit_date, note, scores_json, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET visit_date = excluded.visit_date, note = excluded.note, scores_json = excluded.scores_json, updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
    .bind(zooId, clean(review.visitDate, 20), clean(review.note, 4000), JSON.stringify(scores), userId).run();
}

function decodeImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2]);
  if (binary.length > 5 * 1024 * 1024) throw new Error("De foto is groter dan 5 MB.");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
  return { bytes, contentType: match[1], extension };
}

export async function saveMemory(userId: string, input: MemoryInput) {
  const id = clean(input.id, 160);
  const zooId = clean(input.zooId, 160);
  const caption = clean(input.caption, 160);
  if (!id || !zooId || !caption) throw new Error("Herinnering is niet compleet.");
  const db = database();
  const existing = await db.prepare("SELECT image_key AS imageKey, created_by_user_id AS createdByUserId, created_at AS createdAt FROM shared_memories WHERE id = ?").bind(id).first<{ imageKey?: string; createdByUserId?: string; createdAt?: string }>();
  let imageKey = existing?.imageKey || null;
  let previousImageKey: string | null = null;
  const image = input.imageDataUrl?.startsWith("data:") ? decodeImage(input.imageDataUrl) : null;
  if (image) {
    const nextKey = `memories/${id}/${crypto.randomUUID()}.${image.extension}`;
    await mediaBucket().put(nextKey, image.bytes, { httpMetadata: { contentType: image.contentType } });
    previousImageKey = imageKey;
    imageKey = nextKey;
  }
  await db.prepare("INSERT INTO shared_memories (id, zoo_id, visit_date, caption, note, image_key, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET zoo_id = excluded.zoo_id, visit_date = excluded.visit_date, caption = excluded.caption, note = excluded.note, image_key = excluded.image_key, updated_at = CURRENT_TIMESTAMP")
    .bind(id, zooId, clean(input.date, 20), caption, clean(input.note, 6000), imageKey, existing?.createdByUserId || userId, existing?.createdAt || clean(input.createdAt, 40) || new Date().toISOString()).run();
  if (previousImageKey && previousImageKey !== imageKey) await mediaBucket().delete(previousImageKey);
}

export async function deleteMemory(idValue: unknown) {
  const id = clean(idValue, 160);
  if (!id) throw new Error("Herinnering ontbreekt.");
  const db = database();
  const existing = await db.prepare("SELECT image_key AS imageKey FROM shared_memories WHERE id = ?").bind(id).first<{ imageKey?: string }>();
  await db.prepare("DELETE FROM shared_memories WHERE id = ?").bind(id).run();
  if (existing?.imageKey) await mediaBucket().delete(existing.imageKey);
}

export async function saveCustomPlace(userId: string, place: CustomPlaceInput) {
  const id = clean(place.id, 160);
  const encoded = JSON.stringify(place);
  if (!id || encoded.length > 80_000) throw new Error("Deze dierenplek kon niet worden opgeslagen.");
  await database().prepare("INSERT INTO shared_custom_places (id, place_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET place_json = excluded.place_json, updated_at = CURRENT_TIMESTAMP")
    .bind(id, encoded, userId).run();
}

export async function importLocalJournal(userId: string, snapshot: { wishes?: unknown[]; visitedIds?: unknown[]; visits?: Record<string, VisitInput>; reviews?: Record<string, ReviewInput>; memories?: MemoryInput[]; customPlaces?: CustomPlaceInput[] }) {
  const wished = new Set((snapshot.wishes || []).map((value) => clean(value, 160)).filter(Boolean));
  const visited = new Set((snapshot.visitedIds || []).map((value) => clean(value, 160)).filter(Boolean));
  for (const zooId of new Set([...wished, ...visited])) {
    await database().prepare("INSERT INTO shared_place_states (zoo_id, wished, visited, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(zoo_id) DO UPDATE SET wished = MAX(wished, excluded.wished), visited = MAX(visited, excluded.visited), updated_by_user_id = excluded.updated_by_user_id, updated_at = CURRENT_TIMESTAMP")
      .bind(zooId, wished.has(zooId) ? 1 : 0, visited.has(zooId) ? 1 : 0, userId).run();
  }
  for (const review of Object.values(snapshot.reviews || {})) await saveReview(userId, review);
  for (const visit of Object.values(snapshot.visits || {})) await saveVisit(userId, visit);
  for (const memory of snapshot.memories || []) await saveMemory(userId, memory);
  for (const place of snapshot.customPlaces || []) await saveCustomPlace(userId, place);
}
