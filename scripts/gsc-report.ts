import { getSearchAnalyticsByDimension, type GscRow } from "../lib/search-console";

/**
 * GSC "what's actually ranking" report (v6 diagnostic). Breaks the aggregate
 * impressions the ops digest reports down along two dimensions — top QUERIES and
 * top PAGES — and buckets pages by section, so we can read discovery-intent vs
 * transactional (event-name) search and pick the next Places kind by OBSERVED
 * demand instead of judgment. Read-only; reuses the F2.4 service account. Run it
 * in Actions (where GSC_SERVICE_ACCOUNT_JSON lives) and paste the output back.
 */

const DAYS = 28;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));

/** Section bucket for a page URL, for the discovery-vs-transactional summary. */
function bucket(pageUrl: string): string {
  let path = pageUrl;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    /* keep raw */
  }
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/event/")) return "event (transactional)";
  if (path.startsWith("/places")) return "places (discovery)";
  if (path === "/this-week" || path === "/this-weekend" || path.startsWith("/ongoing")) return "this-week/weekend (discovery)";
  if (path.startsWith("/collections")) return "collections";
  if (path.startsWith("/venues")) return "venues";
  if (path.startsWith("/neighborhoods")) return "neighborhoods";
  if (path.startsWith("/cities")) return "cities";
  if (path.startsWith("/day/")) return "day pages";
  return "other";
}

function printRows(title: string, rows: GscRow[], keyWidth: number, top: number) {
  console.log(`\n## ${title} (top ${Math.min(top, rows.length)} by impressions, ${DAYS}d)`);
  console.log(`${pad("", keyWidth)}  impr   clicks   ctr     pos`);
  for (const r of rows.slice(0, top)) {
    console.log(`${pad(r.key, keyWidth)}  ${String(r.impressions).padStart(5)}  ${String(r.clicks).padStart(5)}   ${pct(r.ctr).padStart(6)}  ${r.position.toFixed(1).padStart(5)}`);
  }
}

async function main() {
  const [queries, pages] = await Promise.all([
    getSearchAnalyticsByDimension("query", DAYS, new Date(), 25),
    getSearchAnalyticsByDimension("page", DAYS, new Date(), 50),
  ]);

  if (queries.length === 0 && pages.length === 0) {
    console.log("[gsc-report] no rows — either GSC_SERVICE_ACCOUNT_JSON isn't set, or the property has no data for the window. (This is the never-break empty, not a crash.)");
    return;
  }

  printRows("TOP QUERIES", queries, 40, 20);
  printRows("TOP PAGES", pages, 46, 20);

  // The key signal: impressions grouped by section.
  const byBucket = new Map<string, { impr: number; clicks: number }>();
  for (const p of pages) {
    const b = bucket(p.key);
    const acc = byBucket.get(b) ?? { impr: 0, clicks: 0 };
    acc.impr += p.impressions;
    acc.clicks += p.clicks;
    byBucket.set(b, acc);
  }
  const totalImpr = [...byBucket.values()].reduce((s, v) => s + v.impr, 0) || 1;
  console.log(`\n## IMPRESSIONS BY SECTION (discovery vs transactional, from the top ${pages.length} pages)`);
  const sorted = [...byBucket.entries()].sort((a, b) => b[1].impr - a[1].impr);
  for (const [b, v] of sorted) {
    console.log(`${pad(b, 30)}  ${String(v.impr).padStart(6)} impr (${pct(v.impr / totalImpr)})  ${String(v.clicks).padStart(4)} clicks`);
  }
  console.log("\n[gsc-report] done. Paste this whole block back to analyze.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
