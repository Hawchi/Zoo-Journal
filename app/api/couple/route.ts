import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { authenticatedUser, memberFor, members } from "../_shared/couple-db";

async function stateFor(userId: string) {
  const profile = await memberFor(userId);
  if (!profile) return { state: "setup", profiles: [] };
  const supabase = await createSupabaseServerClient();
  const [{ data: couple }, profiles] = await Promise.all([
    supabase.from("couples").select("invite_code").eq("id", profile.coupleId).single(),
    members(profile.coupleId),
  ]);
  return { state: "ready", profile, profiles, inviteCode: couple?.invite_code || "" };
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return Response.json({ state: "signed-out" }, { status: 401 });
  return Response.json(await stateFor(user.userId));
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "Log eerst in." }, { status: 401 });
  const body = await request.json() as { action?: string; name?: string; code?: string };
  const name = body.name?.trim().slice(0, 40) || user.fullName || user.displayName || "Gebruiker";
  const supabase = await createSupabaseServerClient();

  let error: { message: string } | null = null;
  if (body.action === "setup") {
    ({ error } = await supabase.rpc("create_couple", { display_name: name }));
  } else if (body.action === "join") {
    ({ error } = await supabase.rpc("join_couple", { invite_code_input: body.code?.trim().toUpperCase() || "", display_name: name }));
  } else if (body.action === "rename") {
    ({ error } = await supabase.rpc("rename_current_member", { display_name: name }));
  } else {
    return Response.json({ error: "Onbekende actie." }, { status: 400 });
  }

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(await stateFor(user.userId));
}
