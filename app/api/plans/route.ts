import { members, requireMember } from "../_shared/couple-db";
import type { SupabaseClient } from "@supabase/supabase-js";

type TripPayload = {
  id: string; zooId: string; date: string; leave: string; start: string; budget: number; tickets: "nee" | "ja"; note: string;
  packing: unknown[]; createdAt: string; requestApproval?: boolean;
};

function tripFromRow(row: Record<string, unknown>) {
  return {
    id: row.id, zooId: row.zoo_id, date: row.date, leave: row.leave_time, start: row.start_point, budget: Number(row.budget) || 0,
    tickets: row.tickets, note: row.note, packing: Array.isArray(row.packing_json) ? row.packing_json : [], createdAt: row.created_at,
    createdById: row.created_by_user_id, requestedFromId: row.requested_from_user_id, approvalStatus: row.approval_status,
  };
}

async function allTrips(supabase: SupabaseClient, coupleId: string) {
  const { data, error } = await supabase.from("shared_trips").select("*").eq("couple_id", coupleId).order("date").order("leave_time");
  if (error) throw error;
  return (data || []).map((row) => tripFromRow(row));
}

export async function GET() {
  const auth = await requireMember(); if ("error" in auth) return auth.error;
  return Response.json({ trips: await allTrips(auth.supabase, auth.member.coupleId) });
}

export async function POST(request: Request) {
  const auth = await requireMember(); if ("error" in auth) return auth.error;
  const trip = await request.json() as TripPayload;
  if (!trip.id || !trip.zooId || !trip.date || !trip.leave || !trip.start) return Response.json({ error: "De planning is niet compleet." }, { status: 400 });
  const partner = (await members(auth.member.coupleId)).find((member) => member.userId !== auth.member.userId);
  const requestedFromId = trip.requestApproval && partner ? partner.userId : null;
  const { data: existing } = await auth.supabase.from("shared_trips").select("created_by_user_id").eq("couple_id", auth.member.coupleId).eq("id", trip.id).maybeSingle();
  const creator = existing?.created_by_user_id || auth.member.userId;
  if (existing && creator !== auth.member.userId) return Response.json({ error: "Alleen de maker kan dit voorstel aanpassen." }, { status: 403 });
  const { error } = await auth.supabase.from("shared_trips").upsert({
    id: trip.id, couple_id: auth.member.coupleId, zoo_id: trip.zooId, date: trip.date, leave_time: trip.leave, start_point: trip.start,
    budget: Math.max(0, Number(trip.budget) || 0), tickets: trip.tickets, note: trip.note || "", packing_json: trip.packing || [],
    created_by_user_id: creator, requested_from_user_id: requestedFromId, approval_status: requestedFromId ? "pending" : "approved",
    created_at: trip.createdAt || new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ trips: await allTrips(auth.supabase, auth.member.coupleId) });
}

export async function PATCH(request: Request) {
  const auth = await requireMember(); if ("error" in auth) return auth.error;
  const body = await request.json() as { id?: string; action?: "approve" | "decline" | "packing"; packing?: unknown[] };
  if (!body.id) return Response.json({ error: "Planning ontbreekt." }, { status: 400 });
  let query;
  if (body.action === "approve" || body.action === "decline") {
    query = auth.supabase.from("shared_trips").update({ approval_status: body.action === "approve" ? "approved" : "declined", updated_at: new Date().toISOString() }).eq("couple_id", auth.member.coupleId).eq("id", body.id).eq("requested_from_user_id", auth.member.userId).eq("approval_status", "pending");
  } else if (body.action === "packing") {
    query = auth.supabase.from("shared_trips").update({ packing_json: body.packing || [], updated_at: new Date().toISOString() }).eq("couple_id", auth.member.coupleId).eq("id", body.id);
  } else return Response.json({ error: "Onbekende actie." }, { status: 400 });
  const { error } = await query; if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ trips: await allTrips(auth.supabase, auth.member.coupleId) });
}

export async function DELETE(request: Request) {
  const auth = await requireMember(); if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id"); if (!id) return Response.json({ error: "Planning ontbreekt." }, { status: 400 });
  const { error } = await auth.supabase.from("shared_trips").delete().eq("couple_id", auth.member.coupleId).eq("id", id).eq("created_by_user_id", auth.member.userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ trips: await allTrips(auth.supabase, auth.member.coupleId) });
}
