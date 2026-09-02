import { redirect } from "next/navigation";

export default function TagsPageRedirect() {
  redirect("/admin/attributes");
}
