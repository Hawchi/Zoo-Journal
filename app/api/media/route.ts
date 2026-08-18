import { database, requireMember } from "../_shared/couple-db";
import { mediaBucket } from "../_shared/journal-db";

export async function GET(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 160);
  if (!id) return new Response("Foto ontbreekt.", { status: 400 });
  const row = await database().prepare("SELECT image_key AS imageKey FROM shared_memories WHERE id = ?").bind(id).first<{ imageKey?: string }>();
  if (!row?.imageKey) return new Response("Foto niet gevonden.", { status: 404 });
  const object = await mediaBucket().get(row.imageKey);
  if (!object) return new Response("Foto niet gevonden.", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
