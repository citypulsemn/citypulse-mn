import { assertAdmin } from "@/lib/admin";
import { listSubscribers } from "@/lib/subscribe";

export const dynamic = "force-dynamic";

function csvCell(v: string): string {
  // Guard against CSV/formula injection and quote/comma/newline breakage.
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  await assertAdmin(); // defense in depth (middleware already gates /admin)

  const rows = await listSubscribers();
  const header = "email,status,source,created_at";
  const body = rows
    .map((r) => [r.email, r.status, r.source, r.created_at].map(csvCell).join(","))
    .join("\n");

  return new Response(`${header}\n${body}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="citypulse-subscribers.csv"',
    },
  });
}
