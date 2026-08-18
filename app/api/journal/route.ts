import { deleteMemory, importLocalJournal, journalState, saveCustomPlace, saveMemory, saveReview, setPlaceState } from "../_shared/journal-db";
import { requireMember } from "../_shared/couple-db";

export async function GET() {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  return Response.json(await journalState());
}

export async function POST(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "place-state") {
      await setPlaceState(auth.member.userId, body.zooId, { wished: typeof body.wished === "boolean" ? body.wished : undefined, visited: typeof body.visited === "boolean" ? body.visited : undefined });
    } else if (body.action === "review") {
      await saveReview(auth.member.userId, body.review as Parameters<typeof saveReview>[1]);
    } else if (body.action === "memory") {
      await saveMemory(auth.member.userId, body.memory as Parameters<typeof saveMemory>[1]);
    } else if (body.action === "custom-place") {
      await saveCustomPlace(auth.member.userId, body.place as Parameters<typeof saveCustomPlace>[1]);
    } else if (body.action === "import") {
      await importLocalJournal(auth.member.userId, body.snapshot as Parameters<typeof importLocalJournal>[1]);
    } else {
      return Response.json({ error: "Onbekende opslagactie." }, { status: 400 });
    }
    return Response.json(await journalState());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Opslaan is niet gelukt." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("resource") !== "memory") return Response.json({ error: "Onbekend onderdeel." }, { status: 400 });
    await deleteMemory(url.searchParams.get("id"));
    return Response.json(await journalState());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verwijderen is niet gelukt." }, { status: 400 });
  }
}
