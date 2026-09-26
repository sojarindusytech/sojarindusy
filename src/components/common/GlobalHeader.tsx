import { fetchCategoriesTree } from "@/actions/category";
import { Navbar } from "./Navbar";
import { getCurrentUserProfile } from "@/actions/auth";
import { isAdminRole } from "@/lib/auth-guard";

export async function GlobalHeader() {
  const [{ treeNodes }, { user, profile }] = await Promise.all([
    fetchCategoriesTree(),
    getCurrentUserProfile(),
  ]);

  const isAdmin = isAdminRole(profile?.role);
  const isManufacturer = profile?.role === "manufacturer";
  const companyName = profile?.company_name || null;
  const userName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null
    : null;

  return (
    <Navbar
      categories={treeNodes}
      user={user}
      isAdmin={isAdmin}
      isManufacturer={isManufacturer}
      companyName={companyName}
      userName={userName}
    />
  );
}

