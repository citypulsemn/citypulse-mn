"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Events" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/pipeline", label: "Pipeline" },
  { href: "/admin/coverage", label: "Coverage" },
  { href: "/admin/stats", label: "Stats" },
  { href: "/admin/digest", label: "Digest" },
  { href: "/admin/instagram", label: "Instagram" },
  { href: "/admin/submissions", label: "Submissions" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="admin-tabs">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <a key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}
