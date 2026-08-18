import { database, members, requireMember } from "../_shared/couple-db";

type TripPayload = {
  id: string; zooId: string; date: string; leave: string; start: string; budget: number; tickets: "nee" | "ja"; note: string;
  packing: unknown[]; createdAt: string; requestApproval?: boolean;
};

function tripFromRow(row: Record<string, unknown>) {
  return {
    id: row.id, zooId: row.zooId, date: row.date, leave: row.leave, start: row.start, budget: row.budget,
    tickets: row.tickets, note: row.note, packing: JSON.parse(String(row.packingJson || "[]")), createdAt: row.createdAt,
    createdById: row.createdById, requestedFromId: row.requestedFromId, approvalStatus: row.approvalStatus,
  };
}

async function allTrips() {
  const rows = await database().prepare("SELECT id, zoo_id AS zooId, date, leave_time AS leave, start_point AS start, budget, tickets, note, packing_json AS packingJson, created_by_user_id AS createdById, requested_from_user_id AS requestedFromId, approval_status AS approvalStatus, created_at AS createdAt FROM shared_trips ORDER BY date, leave_time").all<Record<string, unknown>>();
  return rows.results.map(tripFromRow);
}

export async function GET() {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  return Response.json({ trips: await allTrips() });
}

export async function POST(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  const trip = await request.json() as TripPayload;
  if (!trip.id || !trip.zooId || !trip.date || !trip.leave || !trip.start) return Response.json({ error: "De planning is niet compleet." }, { status: 400 });
  const partner = (await members()).find((member) => member.userId !== auth.member.userId);
  const requestedFromId = trip.requestApproval && partner ? partner.userId : null;
  const status = requestedFromId ? "pending" : "approved";
  const existing = await database().prepare("SELECT created_by_user_id AS createdById FROM shared_trips WHERE id = ?").bind(trip.id).first<{ createdById: string }>();
  const creator = existing?.createdById || auth.member.userId;
  if (existing && creator !== auth.member.userId) return Response.json({ error: "Alleen de maker kan dit voorstel aanpassen." }, { status: 403 });
  await database().prepare("INSERT INTO shared_trips (id, zoo_id, date, leave_time, start_point, budget, tickets, note, packing_json, created_by_user_id, requested_from_user_id, approval_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET zoo_id = excluded.zoo_id, date = excluded.date, leave_time = excluded.leave_time, start_point = excluded.start_point, budget = excluded.budget, tickets = excluded.tickets, note = excluded.note, packing_json = excluded.packing_json, requested_from_user_id = excluded.requested_from_user_id, approval_status = excluded.approval_status, updated_at = CURRENT_TIMESTAMP")
    .bind(trip.id, trip.zooId, trip.date, trip.leave, trip.start, Math.max(0, Number(trip.budget) || 0), trip.tickets, trip.note || "", JSON.stringify(trip.packing || []), creator, requestedFromId, status, trip.createdAt || new Date().toISOString()).run();
  return Response.json({ trips: await allTrips() });
}

export async function PATCH(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  const body = await request.json() as { id?: string; action?: "approve" | "decline" | "packing"; packing?: unknown[] };
  if (!body.id) return Response.json({ error: "Planning ontbreekt." }, { status: 400 });
  const db = database();
  if (body.action === "approve" || body.action === "decline") {
    const result = await db.prepare("UPDATE shared_trips SET approval_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND requested_from_user_id = ? AND approval_status = 'pending'").bind(body.action === "approve" ? "approved" : "declined", body.id, auth.member.userId).run();
    void result;
  } else if (body.action === "packing") {
    await db.prepare("UPDATE shared_trips SET packing_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(JSON.stringify(body.packing || []), body.id).run();
  } else return Response.json({ error: "Onbekende actie." }, { status: 400 });
  return Response.json({ trips: await allTrips() });
}

export async function DELETE(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Planning ontbreekt." }, { status: 400 });
  await database().prepare("DELETE FROM shared_trips WHERE id = ? AND created_by_user_id = ?").bind(id, auth.member.userId).run();
  return Response.json({ trips: await allTrips() });
}
