import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewInput = { zooId: string; visitDate?: string; note?: string; scores: Record<string, number>; updatedAt?: string };
export type MemoryInput = { id: string; zooId: string; date?: string; caption: string; note?: string; imageDataUrl?: string; createdAt?: string };
export type CustomPlaceInput = Record<string, unknown> & { id: string };
export type VisitInput = { zooId: string; date?: string; startPoint?: string; kilometers?: number; updatedAt?: string };

function clean(value: unknown, max = 500) { return String(value || "").trim().slice(0, max); }
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

function memoryFromRow(row: Record<string, unknown>) {
  const updatedAt = String(row.updated_at || row.created_at || "");
  return {
    id: String(row.id), zooId: String(row.zoo_id), date: String(row.visit_date || ""), caption: String(row.caption),
    note: String(row.note || ""), imageDataUrl: row.image_key ? `/api/media?id=${encodeURIComponent(String(row.id))}&v=${encodeURIComponent(updatedAt)}` : undefined,
    createdAt: String(row.created_at || ""),
  };
}

export async function journalState(supabase: SupabaseClient, coupleId: string) {
  const [places, visitsResult, reviewsResult, memoriesResult, customResult] = await Promise.all([
    supabase.from("shared_place_states").select("zoo_id,wished,visited").eq("couple_id", coupleId),
    supabase.from("shared_visits").select("zoo_id,visit_date,start_point,distance_km,updated_at").eq("couple_id", coupleId),
    supabase.from("shared_reviews").select("zoo_id,updated_by_user_id,visit_date,note,scores_json,updated_at").eq("couple_id", coupleId),
    supabase.from("shared_memories").select("id,zoo_id,visit_date,caption,note,image_key,created_at,updated_at").eq("couple_id", coupleId).order("created_at", { ascending: false }),
    supabase.from("shared_custom_places").select("place_json").eq("couple_id", coupleId).order("created_at", { ascending: false }),
  ]);
  [places.error, visitsResult.error, reviewsResult.error, memoriesResult.error, customResult.error].forEach(fail);
  const placeRows = places.data || [];
  const visitRows = visitsResult.data || [];
  const reviews = (reviewsResult.data || []).reduce<Record<string, Array<Record<string, unknown>>>>((result, row) => {
    const zooId = String(row.zoo_id);
    result[zooId] = [...(result[zooId] || []), { zooId, userId: row.updated_by_user_id, visitDate: row.visit_date || "", note: row.note || "", scores: row.scores_json || {}, updatedAt: row.updated_at || "" }];
    return result;
  }, {});
  const visits = Object.fromEntries(visitRows.map((row) => [String(row.zoo_id), { zooId: row.zoo_id, date: row.visit_date || "", startPoint: row.start_point || "", kilometers: Math.max(0, Number(row.distance_km) || 0), updatedAt: row.updated_at || "" }]));
  const visitedIds = new Set(placeRows.filter((row) => row.visited).map((row) => String(row.zoo_id)));
  visitRows.forEach((row) => visitedIds.add(String(row.zoo_id)));
  return {
    wishes: placeRows.filter((row) => row.wished).map((row) => String(row.zoo_id)), visitedIds: [...visitedIds], visits, reviews,
    memories: (memoriesResult.data || []).map(memoryFromRow), customPlaces: (customResult.data || []).map((row) => row.place_json).filter(Boolean),
  };
}

export async function saveVisit(supabase: SupabaseClient, coupleId: string, userId: string, input: VisitInput) {
  const zooId = clean(input.zooId, 160), date = clean(input.date, 20), startPoint = clean(input.startPoint, 240);
  const kilometers = Math.max(0, Math.min(100000, Number(input.kilometers) || 0));
  if (!zooId || !date || !startPoint) throw new Error("Bezoekgegevens zijn niet compleet.");
  const [{ error: visitError }, { error: stateError }] = await Promise.all([
    supabase.from("shared_visits").upsert({ couple_id: coupleId, zoo_id: zooId, visit_date: date, start_point: startPoint, distance_km: kilometers, updated_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "couple_id,zoo_id" }),
    supabase.from("shared_place_states").upsert({ couple_id: coupleId, zoo_id: zooId, wished: false, visited: true, updated_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "couple_id,zoo_id" }),
  ]);
  fail(visitError); fail(stateError);
}

export async function deleteVisit(supabase: SupabaseClient, coupleId: string, userId: string, zooIdValue: unknown) {
  const zooId = clean(zooIdValue, 160);
  if (!zooId) throw new Error("Dierenplek ontbreekt.");
  const { error } = await supabase.from("shared_visits").delete().eq("couple_id", coupleId).eq("zoo_id", zooId); fail(error);
  const { data: current } = await supabase.from("shared_place_states").select("wished").eq("couple_id", coupleId).eq("zoo_id", zooId).maybeSingle();
  const { error: stateError } = await supabase.from("shared_place_states").upsert({ couple_id: coupleId, zoo_id: zooId, wished: Boolean(current?.wished), visited: false, updated_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "couple_id,zoo_id" }); fail(stateError);
}

export async function setPlaceState(supabase: SupabaseClient, coupleId: string, userId: string, zooIdValue: unknown, values: { wished?: boolean; visited?: boolean }) {
  const zooId = clean(zooIdValue, 160); if (!zooId) throw new Error("Dierenplek ontbreekt.");
  const { data: current } = await supabase.from("shared_place_states").select("wished,visited").eq("couple_id", coupleId).eq("zoo_id", zooId).maybeSingle();
  const { error } = await supabase.from("shared_place_states").upsert({ couple_id: coupleId, zoo_id: zooId, wished: values.wished ?? Boolean(current?.wished), visited: values.visited ?? Boolean(current?.visited), updated_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "couple_id,zoo_id" }); fail(error);
}

export async function saveReview(supabase: SupabaseClient, coupleId: string, userId: string, review: ReviewInput) {
  const zooId = clean(review.zooId, 160); if (!zooId || !review.scores) throw new Error("Beoordeling is niet compleet.");
  const scores = Object.fromEntries(Object.entries(review.scores).map(([key, value]) => [clean(key, 40), Math.max(0, Math.min(10, Number(value) || 0))]));
  const { error } = await supabase.from("shared_reviews").upsert({ couple_id: coupleId, zoo_id: zooId, visit_date: clean(review.visitDate, 20), note: clean(review.note, 4000), scores_json: scores, updated_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "couple_id,zoo_id,updated_by_user_id" }); fail(error);
}

function decodeImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl); if (!match) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64")); if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("De foto is groter dan 5 MB.");
  return { bytes, contentType: match[1], extension: match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg" };
}

export async function saveMemory(supabase: SupabaseClient, coupleId: string, userId: string, input: MemoryInput) {
  const id = clean(input.id, 160), zooId = clean(input.zooId, 160), caption = clean(input.caption, 160); if (!id || !zooId || !caption) throw new Error("Herinnering is niet compleet.");
  const { data: existing } = await supabase.from("shared_memories").select("image_key,created_by_user_id,created_at").eq("couple_id", coupleId).eq("id", id).maybeSingle();
  let imageKey = existing?.image_key || null;
  const image = input.imageDataUrl?.startsWith("data:") ? decodeImage(input.imageDataUrl) : null;
  if (image) {
    const nextKey = `${coupleId}/${id}/${crypto.randomUUID()}.${image.extension}`;
    const { error } = await supabase.storage.from("memories").upload(nextKey, image.bytes, { contentType: image.contentType }); fail(error);
    if (imageKey) await supabase.storage.from("memories").remove([imageKey]);
    imageKey = nextKey;
  }
  const { error } = await supabase.from("shared_memories").upsert({ id, couple_id: coupleId, zoo_id: zooId, visit_date: clean(input.date, 20), caption, note: clean(input.note, 6000), image_key: imageKey, created_by_user_id: existing?.created_by_user_id || userId, created_at: existing?.created_at || input.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "id" }); fail(error);
}

export async function deleteMemory(supabase: SupabaseClient, coupleId: string, idValue: unknown) {
  const id = clean(idValue, 160); if (!id) throw new Error("Herinnering ontbreekt.");
  const { data: existing } = await supabase.from("shared_memories").select("image_key").eq("couple_id", coupleId).eq("id", id).maybeSingle();
  const { error } = await supabase.from("shared_memories").delete().eq("couple_id", coupleId).eq("id", id); fail(error);
  if (existing?.image_key) await supabase.storage.from("memories").remove([existing.image_key]);
}

export async function saveCustomPlace(supabase: SupabaseClient, coupleId: string, userId: string, place: CustomPlaceInput) {
  const id = clean(place.id, 160); if (!id || JSON.stringify(place).length > 80000) throw new Error("Deze dierenplek kon niet worden opgeslagen.");
  const { error } = await supabase.from("shared_custom_places").upsert({ id, couple_id: coupleId, place_json: place, created_by_user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "id" }); fail(error);
}

export async function importLocalJournal(supabase: SupabaseClient, coupleId: string, userId: string, snapshot: { wishes?: unknown[]; visitedIds?: unknown[]; visits?: Record<string, VisitInput>; reviews?: Record<string, ReviewInput | ReviewInput[]>; memories?: MemoryInput[]; customPlaces?: CustomPlaceInput[] }) {
  const wished = new Set((snapshot.wishes || []).map((value) => clean(value, 160)).filter(Boolean));
  const visited = new Set((snapshot.visitedIds || []).map((value) => clean(value, 160)).filter(Boolean));
  for (const zooId of new Set([...wished, ...visited])) await setPlaceState(supabase, coupleId, userId, zooId, { wished: wished.has(zooId), visited: visited.has(zooId) });
  for (const stored of Object.values(snapshot.reviews || {})) for (const review of Array.isArray(stored) ? stored : [stored]) await saveReview(supabase, coupleId, userId, review);
  for (const visit of Object.values(snapshot.visits || {})) await saveVisit(supabase, coupleId, userId, visit);
  for (const memory of snapshot.memories || []) await saveMemory(supabase, coupleId, userId, memory);
  for (const place of snapshot.customPlaces || []) await saveCustomPlace(supabase, coupleId, userId, place);
}
