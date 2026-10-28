import { deleteMemory, deleteVisit, importLocalJournal, journalState, saveCustomPlace, saveMemory, saveReview, saveVisit, setPlaceState } from "../_shared/journal-db";
import { requireMember } from "../_shared/couple-db";

export async function GET() {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  return Response.json(await journalState(auth.supabase, auth.member.coupleId));
}

export async function POST(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "place-state") {
      await setPlaceState(auth.supabase, auth.member.coupleId, auth.member.userId, body.zooId, { wished: typeof body.wished === "boolean" ? body.wished : undefined, visited: typeof body.visited === "boolean" ? body.visited : undefined });
    } else if (body.action === "review") {
      await saveReview(auth.supabase, auth.member.coupleId, auth.member.userId, body.review as Parameters<typeof saveReview>[3]);
    } else if (body.action === "visit") {
      await saveVisit(auth.supabase, auth.member.coupleId, auth.member.userId, body.visit as Parameters<typeof saveVisit>[3]);
    } else if (body.action === "memory") {
      await saveMemory(auth.supabase, auth.member.coupleId, auth.member.userId, body.memory as Parameters<typeof saveMemory>[3]);
    } else if (body.action === "custom-place") {
      await saveCustomPlace(auth.supabase, auth.member.coupleId, auth.member.userId, body.place as Parameters<typeof saveCustomPlace>[3]);
    } else if (body.action === "import") {
      await importLocalJournal(auth.supabase, auth.member.coupleId, auth.member.userId, body.snapshot as Parameters<typeof importLocalJournal>[3]);
    } else {
      return Response.json({ error: "Onbekende opslagactie." }, { status: 400 });
    }
    return Response.json(await journalState(auth.supabase, auth.member.coupleId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Opslaan is niet gelukt." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource");
    if (resource === "memory") await deleteMemory(auth.supabase, auth.member.coupleId, url.searchParams.get("id"));
    else if (resource === "visit") await deleteVisit(auth.supabase, auth.member.coupleId, auth.member.userId, url.searchParams.get("zooId"));
    else return Response.json({ error: "Onbekend onderdeel." }, { status: 400 });
    return Response.json(await journalState(auth.supabase, auth.member.coupleId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verwijderen is niet gelukt." }, { status: 400 });
  }
}
