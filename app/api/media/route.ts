import { requireMember } from "../_shared/couple-db";

export async function GET(request: Request) {
  const auth = await requireMember();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 160);
  if (!id) return new Response("Foto ontbreekt.", { status: 400 });
  const { data: row } = await auth.supabase.from("shared_memories").select("image_key").eq("couple_id", auth.member.coupleId).eq("id", id).maybeSingle();
  if (!row?.image_key) return new Response("Foto niet gevonden.", { status: 404 });
  const { data, error } = await auth.supabase.storage.from("memories").download(row.image_key);
  if (error || !data) return new Response("Foto niet gevonden.", { status: 404 });
  return new Response(data, { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
}
