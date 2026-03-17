import { redirect } from "next/navigation";
import { requireAdminSession } from "../../lib/auth";

export default async function AdminEntryPage() {
  await requireAdminSession();
  redirect("/upload");
}
