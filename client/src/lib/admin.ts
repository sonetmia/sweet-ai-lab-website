import { supabase } from "./supabase";

export async function bootstrapConfiguredAdmin() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const response = await fetch("/api/admin/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  const result = await response.json().catch(() => null) as { elevated?: boolean } | null;
  return Boolean(result?.elevated);
}
