import { fetchCategoriesTree } from "@/actions/category";
import { Navbar } from "./Navbar";
import { createClient } from "@/lib/supabase/server";

export async function GlobalHeader() {
  const { treeNodes } = await fetchCategoriesTree();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <Navbar categories={treeNodes} user={user} />;
}
