import { getSearchAnalyticsByDimension, inspectUrls, type GscRow } from "../lib/search-console";
import { VENUE_PAGES } from "../lib/venue-pages";

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

/**
 * This was 50, which quietly made the section summary below a top-50 ARTEFACT
 * rather than a measurement: any section whose pages all rank outside the top 50
 * summed to zero and read as "no demand". That is the difference between a
 * number and a floor, and the /venues question (SCOPE-VENUE-PAGES-FOR-EARNERS)
 * is exactly the case it would have got wrong — 48 venue URLs against 763 event
 * and 586 places URLs would never have cleared a top-50 cut.
 * The sitemap carries 1,578 URLs, so this limit now exceeds the whole site and
 * the sums are complete. GSC returns only pages with >=1 impression, so if the
 * cap is ever reached the sums are a floor again — flagged in the header below.
 */
const PAGE_ROWS = 2000;

/**
 * Same defect, second axis. The query fetch was 25 and printed 20, so any query
 * below the 20th was invisible — and on 30 Oct 2026 that was read as "Walker Art
 * Center has no search demand" when all it meant was "not in the printed 20".
 * Raised so the branded-query block below measures instead of bounding.
 */
const QUERY_ROWS = 2000;

/**
 * An empty reader result is AMBIGUOUS and must never be reported as a finding.
 *
 * getSearchAnalyticsByDimension returns [] both when the property genuinely has
 * no rows AND when the request fails — that is the never-break contract (rule 1)
 * and it is correct for the page and the ops email, which only need a number or
 * an honest blank. A report that draws conclusions cannot live with it.
 *
 * Paid for on 30 Oct 2026: the re-run hit `[gsc] page report failed: TypeError:
 * fetch failed`, so `pages` came back []. Every derived line then stated, in the
 * same confident format as a real result, that 47 of 47 venue slugs earned zero
 * impressions and that the section sums were "complete" — on a run where nothing
 * had been read at all. Forty minutes earlier the same query had returned 1,801
 * rows with /venues/armory 4th on the site. Rule 6: the exclusion gets reported
 * with its reason, and the run exits non-zero so a failed read is loud instead
 * of looking like a site with no search traffic.
 */
function unreadable(what: string, rows: unknown[]): boolean {
  if (rows.length > 0) return false;
  console.log(`\n## ${what.toUpperCase()} — NOT MEASURED THIS RUN`);
  console.log(`  The ${what} read returned 0 rows. The readers return [] for "no data" AND`);
  console.log(`  for "the read failed" (never-break), so this run cannot tell which. Look for`);
  console.log(`  a "[gsc] ${what} report failed" line above: present => the read failed and`);
  console.log(`  NOTHING below about ${what} is a measurement. Re-run before concluding anything.`);
  return true;
}

async function main() {
  // Deliberately serial, not Promise.all. Two concurrent 2,000-row requests is
  // what produced the `fetch failed` above; the first run that measured 1,801
  // pages fired only one large request. Serial costs a second or two and takes
  // concurrent load off the table as a cause.
  const queries = await getSearchAnalyticsByDimension("query", DAYS, new Date(), QUERY_ROWS);
  const pages = await getSearchAnalyticsByDimension("page", DAYS, new Date(), PAGE_ROWS);

  const noQueries = unreadable("query", queries);
  const noPages = unreadable("page", pages);
  if (noQueries && noPages) {
    console.log("\n[gsc-report] both reads empty — if there is no failure line above, then");
    console.log("GSC_SERVICE_ACCOUNT_JSON isn't set or the property has no data for the window.");
    process.exit(1);
  }

  if (!noQueries) printRows("TOP QUERIES", queries, 40, 20);
  if (!noPages) printRows("TOP PAGES", pages, 46, 20);

  // The key signal: impressions grouped by section. `pages` counts how many URLs
  // in the section earned AT LEAST ONE impression, which is the honest-emptiness
  // instrument (rule 6): a section reading "0 impr / 0 pages" is invisible to
  // search, while "0 impr / 12 pages" would be a different fact entirely. The
  // section total alone cannot tell those apart, and a product decision about
  // whether to build more pages of a given kind turns on which one it is.
  if (!noPages) {
    const byBucket = new Map<string, { impr: number; clicks: number; pages: number }>();
    for (const p of pages) {
      const b = bucket(p.key);
      const acc = byBucket.get(b) ?? { impr: 0, clicks: 0, pages: 0 };
      acc.impr += p.impressions;
      acc.clicks += p.clicks;
      acc.pages += 1;
      byBucket.set(b, acc);
    }
    const totalImpr = [...byBucket.values()].reduce((s, v) => s + v.impr, 0) || 1;
    const capped = pages.length >= PAGE_ROWS;
    console.log(
      `\n## IMPRESSIONS BY SECTION (${pages.length} page(s) with >=1 impression, ${DAYS}d` +
        `${capped ? ` — AT THE ${PAGE_ROWS}-ROW CAP, so every sum below is a FLOOR` : ", complete — not a top-N slice"})`,
    );
    const sorted = [...byBucket.entries()].sort((a, b) => b[1].impr - a[1].impr);
    for (const [b, v] of sorted) {
      console.log(`${pad(b, 30)}  ${String(v.impr).padStart(6)} impr (${pct(v.impr / totalImpr)})  ${String(v.clicks).padStart(4)} clicks  ${String(v.pages).padStart(4)} page(s)`);
    }
  }

  // ── /venues, every row ─────────────────────────────────────────────────────
  // The section line above is a sum, and a sum hid the whole story on 30 Oct:
  // ONE page (/venues/armory) was 80% of the bucket, so the per-page averages
  // described a page that does not exist. These rows were already fetched and
  // then thrown away by printRows' top-20 cut. Printing them also shows whether
  // a ranking /venues URL is a CURRENT slug — GSC reports retired URLs too (this
  // run: 1,801 ranking URLs against 1,578 in the sitemap), and SLUG_OVERRIDES
  // exists because derived venue slugs have drifted before.
  // Guarded: on an unread page set this block would otherwise announce that all
  // 47 slugs earned zero, which is what it did on the 30 Oct re-run.
  if (!noPages) {
    const venueRows = pages.filter((p) => bucket(p.key) === "venues");
    const live = new Set(VENUE_PAGES.map((v) => v.slug));
    console.log(`\n## /VENUES — EVERY RANKING ROW (${venueRows.length} of ${VENUE_PAGES.length + 1} URLs: index + ${VENUE_PAGES.length} slugs)`);
    console.log(`${pad("", 44)}  impr   clicks   ctr     pos`);
    for (const r of venueRows) {
      const path = r.key.replace(/^https?:\/\/[^/]+/, "");
      const slug = path.startsWith("/venues/") ? path.slice("/venues/".length) : "";
      const flag = slug === "" ? "  (index)" : live.has(slug) ? "" : "  <- NOT A CURRENT SLUG";
      console.log(`${pad(path, 44)}  ${String(r.impressions).padStart(5)}  ${String(r.clicks).padStart(5)}   ${pct(r.ctr).padStart(6)}  ${r.position.toFixed(1).padStart(5)}${flag}`);
    }
    const ranked = new Set(venueRows.map((r) => r.key.replace(/^https?:\/\/[^/]+\/venues\/?/, "")).filter(Boolean));
    const silent = VENUE_PAGES.filter((v) => !ranked.has(v.slug)).map((v) => v.slug);
    console.log(`\n  ${silent.length} current venue slug(s) earned ZERO impressions in ${DAYS}d:`);
    console.log(`  ${silent.join(", ") || "(none)"}`);
  }

  // ── Venue-branded query demand ─────────────────────────────────────────────
  // The Step B question is whether a named room has branded search demand we are
  // not serving with a page. HEURISTIC, and labelled as one: a query matches on
  // the first two significant words of a venue name, so it will miss nicknames
  // and over-match generic names. A zero here is "no match by this rule", NOT
  // proof of no demand (rule 6). Walker and Chanhassen are included explicitly
  // because they are the Step B candidates and are NOT in the registry today.
  if (!noQueries) {
    const stem = (name: string) =>
      name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
    const CANDIDATES = [
      ...VENUE_PAGES.map((v) => ({ label: v.name, key: stem(v.name), onSite: true })),
      { label: "Walker Art Center (Step B, no page)", key: "walker art", onSite: false },
      { label: "Chanhassen Dinner Theatres (Step B, no page)", key: "chanhassen dinner", onSite: false },
    ].filter((c) => c.key.length >= 6);
    const atCap = queries.length >= QUERY_ROWS;
    console.log(
      `\n## VENUE-BRANDED QUERY DEMAND (heuristic: first two words of the venue name, ${DAYS}d, from ${queries.length} queries` +
        `${atCap ? ` — AT THE ${QUERY_ROWS}-ROW CAP, so these are FLOORS` : ", complete"})`,
    );
    const branded = CANDIDATES.map((c) => {
      const hits = queries.filter((q) => q.key.toLowerCase().includes(c.key));
      return { ...c, impr: hits.reduce((s, q) => s + q.impressions, 0), clicks: hits.reduce((s, q) => s + q.clicks, 0), n: hits.length };
    })
      .filter((c) => c.impr > 0)
      .sort((a, b) => b.impr - a.impr);
    for (const c of branded) {
      const ctr = c.impr ? pct(c.clicks / c.impr) : "—";
      console.log(`${pad(c.label, 44)}  ${String(c.impr).padStart(5)} impr  ${String(c.clicks).padStart(4)} clicks  ${ctr.padStart(6)}  ${c.n} query(ies)${c.onSite ? "" : "  <- NO VENUE PAGE"}`);
    }
    if (branded.length === 0) console.log("  (no venue name matched any query by this rule)");
    const unmatched = CANDIDATES.filter((c) => !branded.some((b) => b.key === c.key)).length;
    console.log(`  ${unmatched} of ${CANDIDATES.length} candidate name(s) matched NO query by this rule — unmeasured, not zero.`);
  }
  // Indexation check (URL Inspection API): is /places even indexed? And are the
  // discovery shop-windows (/this-week[end]) indexed? Answers whether Places'
  // zero impressions is "not indexed" (a fixable blocker) vs "indexed but not
  // ranking yet" (a maturity wait — don't keep building kinds on faith).
  // Kind pages AND detail pages. Only kind pages were ever inspected, which
  // hid the thing that mattered: 587 of the 589 Places URLs in the sitemap are
  // DETAIL pages, and they earn 180 impressions a month between them (0.9% of
  // the site) — 0.3 impressions per page. Whether that is "not indexed" or
  // "indexed and invisible" is the whole question, and nothing was asking it.
  const INDEX_PATHS = [
    "/places", "/places/splash-pad", "/places/rink", "/places/ski-hill",
    "/places/orchard/aamodts-apple-farm",
    "/places/disc-golf/acorn-park-disc-golf",
    "/places/indoor-playground/adventure-peak-edinborough",
    "/places/museum/american-swedish-institute",
    "/places/park/afton-state-park",
    "/places/dog-park/alimagnet-dog-park",
    "/this-week", "/this-weekend",
    // VENUES (added 30 Oct 2026 for SCOPE-VENUE-PAGES-FOR-EARNERS). The section
    // summary says whether these pages get demand; this says whether Google has
    // them at all. Those are different answers with opposite consequences — "not
    // indexed" is a fixable blocker, "indexed and ignored" closes the item — and
    // the scope doc was about to recommend building ~286 more of these pages
    // without knowing which it was. Three real slugs from the live sitemap.
    "/venues", "/venues/first-avenue", "/venues/armory", "/venues/palace-theatre",
  ];
  const idx = await inspectUrls(INDEX_PATHS, new Date());
  if (idx.length > 0) {
    console.log("\n## INDEXATION CHECK (URL Inspection API)");
    for (const s of idx) {
      const crawl = s.lastCrawlTime ? `  last crawl ${s.lastCrawlTime.slice(0, 10)}` : "";
      console.log(`${pad(s.url, 50)}  ${pad(s.verdict, 8)}  ${s.coverageState}${crawl}`);
    }
  }

  if (noQueries || noPages) {
    console.log(`\n[gsc-report] INCOMPLETE — the ${noPages ? "page" : "query"} read returned nothing.`);
    console.log("Do not record any figure from this run for that dimension. Re-run it.");
    process.exit(1);
  }

  console.log("\n[gsc-report] done. Paste this whole block back to analyze.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
