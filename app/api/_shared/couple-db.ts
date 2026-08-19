import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<unknown>;
};

export type CoupleMember = {
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "partner";
};

export function database(): D1DatabaseLike {
  const db = (env as unknown as { DB?: D1DatabaseLike }).DB;
  if (!db) throw new Error("De gedeelde opslag is nog niet verbonden.");
  return db;
}

export async function ensureCoupleTables() {
  const db = database();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS couple_settings (id INTEGER PRIMARY KEY, owner_user_id TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS couple_members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL UNIQUE, email TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL, joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_trips (id TEXT PRIMARY KEY, zoo_id TEXT NOT NULL, date TEXT NOT NULL, leave_time TEXT NOT NULL, start_point TEXT NOT NULL, budget INTEGER NOT NULL DEFAULT 0, tickets TEXT NOT NULL DEFAULT 'nee', note TEXT NOT NULL DEFAULT '', packing_json TEXT NOT NULL DEFAULT '[]', created_by_user_id TEXT NOT NULL, requested_from_user_id TEXT, approval_status TEXT NOT NULL DEFAULT 'approved', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_shared_trips_requested_status ON shared_trips(requested_from_user_id, approval_status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_shared_trips_date ON shared_trips(date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_place_states (zoo_id TEXT PRIMARY KEY, wished INTEGER NOT NULL DEFAULT 0, visited INTEGER NOT NULL DEFAULT 0, updated_by_user_id TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_visits (zoo_id TEXT PRIMARY KEY, visit_date TEXT NOT NULL, start_point TEXT NOT NULL, distance_km REAL NOT NULL DEFAULT 0, updated_by_user_id TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_shared_visits_visit_date ON shared_visits(visit_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_reviews (zoo_id TEXT NOT NULL, visit_date TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', scores_json TEXT NOT NULL, updated_by_user_id TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (zoo_id, updated_by_user_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_shared_reviews_user_id ON shared_reviews(updated_by_user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_memories (id TEXT PRIMARY KEY, zoo_id TEXT NOT NULL, visit_date TEXT NOT NULL DEFAULT '', caption TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', image_key TEXT, created_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_shared_memories_visit_date ON shared_memories(visit_date)"),
    db.prepare("CREATE TABLE IF NOT EXISTS shared_custom_places (id TEXT PRIMARY KEY, place_json TEXT NOT NULL, created_by_user_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  ]);
}

export async function authenticatedUser(): Promise<ChatGPTUser | null> {
  return getChatGPTUser();
}

export async function members(): Promise<CoupleMember[]> {
  const result = await database().prepare("SELECT user_id AS userId, email, display_name AS displayName, role FROM couple_members ORDER BY id").all<CoupleMember>();
  return result.results;
}

export async function memberFor(userId: string): Promise<CoupleMember | null> {
  return database().prepare("SELECT user_id AS userId, email, display_name AS displayName, role FROM couple_members WHERE user_id = ? LIMIT 1").bind(userId).first<CoupleMember>();
}

export async function requireMember() {
  const user = await authenticatedUser();
  if (!user) return { error: Response.json({ error: "Log in om jullie gedeelde dagboek te openen." }, { status: 401 }) } as const;
  await ensureCoupleTables();
  const member = await memberFor(user.userId);
  if (!member) return { user, error: Response.json({ error: "Dit account hoort nog niet bij dit dagboek." }, { status: 403 }) } as const;
  return { user, member } as const;
}

export function inviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
