import type { ReactNode } from "react";
import { AdminNav } from "../../components/admin-nav";
import { requireAdminSession } from "../../lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminSession();

  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">
        <div className="container admin-stack">{children}</div>
      </main>
    </div>
  );
}
