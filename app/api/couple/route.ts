import { authenticatedUser, database, ensureCoupleTables, inviteCode, memberFor, members } from "../_shared/couple-db";

async function stateFor(userId: string) {
  const allMembers = await members();
  const profile = allMembers.find((member) => member.userId === userId) || null;
  const settings = await database().prepare("SELECT invite_code AS inviteCode FROM couple_settings WHERE id = 1").first<{ inviteCode: string }>();
  if (!allMembers.length) return { state: "setup", profiles: [] };
  if (!profile) return { state: "join", profiles: [] };
  return { state: "ready", profile, profiles: allMembers, inviteCode: settings?.inviteCode || "" };
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return Response.json({ state: "signed-out" }, { status: 401 });
  await ensureCoupleTables();
  return Response.json(await stateFor(user.userId));
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return Response.json({ error: "Log eerst in." }, { status: 401 });
  await ensureCoupleTables();
  const body = await request.json() as { action?: string; name?: string; code?: string };
  const name = body.name?.trim().slice(0, 40) || user.fullName || user.displayName.split("@")[0] || "Paulien";
  const db = database();

  if (body.action === "setup") {
    const existing = await members();
    if (!existing.length) {
      const code = inviteCode();
      await db.batch([
        db.prepare("INSERT INTO couple_settings (id, owner_user_id, invite_code) VALUES (1, ?, ?)").bind(user.userId, code),
        db.prepare("INSERT INTO couple_members (user_id, email, display_name, role) VALUES (?, ?, ?, 'owner')").bind(user.userId, user.email, name),
      ]);
    }
  } else if (body.action === "join") {
    const settings = await db.prepare("SELECT invite_code AS inviteCode FROM couple_settings WHERE id = 1").first<{ inviteCode: string }>();
    if (!settings || settings.inviteCode !== body.code?.trim().toUpperCase()) return Response.json({ error: "Deze koppelcode klopt niet." }, { status: 400 });
    const existing = await members();
    if (existing.length >= 2) return Response.json({ error: "Dit dagboek heeft al twee accounts." }, { status: 409 });
    if (!(await memberFor(user.userId))) await db.prepare("INSERT INTO couple_members (user_id, email, display_name, role) VALUES (?, ?, ?, 'partner')").bind(user.userId, user.email, name).run();
  } else if (body.action === "rename") {
    if (!(await memberFor(user.userId))) return Response.json({ error: "Geen toegang." }, { status: 403 });
    await db.prepare("UPDATE couple_members SET display_name = ? WHERE user_id = ?").bind(name, user.userId).run();
  } else {
    return Response.json({ error: "Onbekende actie." }, { status: 400 });
  }

  return Response.json(await stateFor(user.userId));
}
