import type { Metadata } from "next";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const metadata: Metadata = {
  title: "Admin · City Pulse MN",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-brand">
          City Pulse <span>Admin</span>
        </div>
        <a className="admin-exit" href="/">
          View site ↗
        </a>
      </header>
      <AdminTabs />
      <main className="admin-main">{children}</main>
    </div>
  );
}
