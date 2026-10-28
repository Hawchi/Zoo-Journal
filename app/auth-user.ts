import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../lib/supabase/server";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { userId: user.id, displayName: fullName || user.email.split("@")[0] || "Gebruiker", email: user.email, fullName };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;
  redirect("/login");
}
