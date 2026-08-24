import { fetchCategoriesTree } from "@/actions/category";
import { Navbar } from "./Navbar";

export async function GlobalHeader() {
  const { treeNodes } = await fetchCategoriesTree();
  return <Navbar categories={treeNodes} />;
}
