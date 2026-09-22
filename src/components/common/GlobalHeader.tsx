import { fetchCategoriesTree } from "@/actions/category";
import { Navbar } from "./Navbar";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, isAdminRole } from "@/lib/auth-guard";

export async function GlobalHeader() {
  const { treeNodes } = await fetchCategoriesTree();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Resolved here from the profiles table rather than in the Navbar from
  // `user_metadata`, which the account holder can write to.
  const ctx = user ? await getAuthContext() : null;

  return <Navbar categories={treeNodes} user={user} isAdmin={isAdminRole(ctx?.role)} />;
}
