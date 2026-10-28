import { getAuthenticatedUser, type AuthenticatedUser } from "../../auth-user";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export type CoupleMember = {
  coupleId: string;
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "partner";
};

function memberFromRow(row: Record<string, unknown>): CoupleMember {
  return {
    coupleId: String(row.couple_id),
    userId: String(row.user_id),
    email: String(row.email || ""),
    displayName: String(row.display_name || "Gebruiker"),
    role: row.role === "owner" ? "owner" : "partner",
  };
}

export async function authenticatedUser(): Promise<AuthenticatedUser | null> {
  return getAuthenticatedUser();
}

export async function memberFor(userId: string): Promise<CoupleMember | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("couple_members").select("couple_id,user_id,email,display_name,role").eq("user_id", userId).maybeSingle();
  return data ? memberFromRow(data) : null;
}

export async function members(coupleId?: string): Promise<CoupleMember[]> {
  const supabase = await createSupabaseServerClient();
  let target = coupleId;
  if (!target) {
    const user = await authenticatedUser();
    if (!user) return [];
    target = (await memberFor(user.userId))?.coupleId;
  }
  if (!target) return [];
  const { data, error } = await supabase.from("couple_members").select("couple_id,user_id,email,display_name,role").eq("couple_id", target).order("joined_at");
  if (error) throw error;
  return (data || []).map((row) => memberFromRow(row));
}

export async function requireMember() {
  const user = await authenticatedUser();
  if (!user) return { error: Response.json({ error: "Log in om jullie gedeelde dagboek te openen." }, { status: 401 }) } as const;
  const member = await memberFor(user.userId);
  if (!member) return { user, error: Response.json({ error: "Dit account hoort nog niet bij een dagboek." }, { status: 403 }) } as const;
  const supabase = await createSupabaseServerClient();
  return { user, member, supabase } as const;
}
