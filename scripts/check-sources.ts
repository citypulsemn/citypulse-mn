/**
 * Is every live listing actually on the page it cites?
 *
 *   npx tsx scripts/check-sources.ts                 look, write nothing
 *   npx tsx scripts/check-sources.ts --apply         flag what is missing
 *   … --limit=40                                     cap the fetches
 *   … --host=threeriversparks.org                    one source only
 *
 * Costs one HTTP fetch per DISTINCT source URL and no model call at all, which
 * is why it can run over the whole calendar. Born from "Prairie Bathing Under a
 * Harvest Moon" (14 Sep 2026): live, stamped verified, and absent from the
 * index page it named as its source.
 *
 * WHAT IT DOES TO A ROW, AND WHAT IT WILL NEVER DO. A missing listing is
 * FLAGGED and un-verified. It is never archived and never edited. A wrong
 * accusation then costs a human one glance, and the flag is self-clearing the
 * way the others are — it reads the listing's current state, not the flag
 * count. Archiving on a heuristic is how you delete a real event.
 *
 * Withdrawing `verified_at` is deliberate rather than incidental: the ops
 * digest's queue only reports flags on UNVERIFIED listings, so a fabrication
 * carrying a stamp would be flagged into a place nobody looks — which is
 * exactly how this one survived. And a verified claim that cannot be
 * corroborated on the listing's own cited source has not earned the stamp.
 */
import { requireSql } from "../lib/db";
import {
  checkTitleOnPage,
  htmlToText,
  isTransientNetworkError,
  type SourceCheck,
} from "../lib/source-presence";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const APPLY = process.argv.includes("--apply");
const LIMIT = Math.max(1, Number(arg("limit") ?? 400));
const HOST = arg("host");
const TIMEOUT_MS = 12_000;
const PAUSE_MS = 700; // be a polite guest on someone else's site

/**
 * One rude host must not kill the sweep.
 *
 * The first full run died at page 580 of 677 with "Unhandled 'error' event —
 * SocketError: other side closed". A pooled HTTP/2 connection dropped AFTER its
 * fetch had already settled, so the error surfaced on a stream nobody was
 * listening to and Node turned it into an uncaught exception. The per-fetch
 * try/catch cannot see that: there is no promise left to reject.
 *
 * Rule 1 — an instrument must not be killable by the thing it measures. Only
 * socket-shaped failures are swallowed and counted; anything else still crashes
 * loudly, because a real bug hiding behind this handler would be worse than the
 * crash it replaces.
 */
let socketErrors = 0;
process.on("uncaughtException", (err) => {
  if (!isTransientNetworkError(err)) throw err;
  socketErrors++;
});
process.on("unhandledRejection", (err) => {
  if (!isTransientNetworkError(err)) throw err;
  socketErrors++;
});

type Row = {
  id: string; title: string; venue: string; source_url: string; verified: boolean;
  /** "MM-DD" for the log. */ day: string;
  /** "YYYY-MM-DD" — gates every negative; see lib/source-presence.ts. */ iso: string;
};

async function fetchText(url: string): Promise<{ text: string } | { error: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Identify honestly. A site that would rather we did not read it can
        // say so, and a 403 becomes `unchecked`, not an accusation.
        "User-Agent": "citypulsemn/1.0 (+https://www.citypulsemn.com; listing verification)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return { error: `${res.status} ${res.statusText}` };
    const ct = res.headers.get("content-type") ?? "";
    if (!/html|text/i.test(ct)) return { error: `not a web page (${ct.split(";")[0] || "unknown type"})` };
    return { text: htmlToText(await res.text()) };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return { error: m.includes("abort") ? `no answer in ${TIMEOUT_MS / 1000}s` : m.slice(0, 90) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const sql = requireSql();

  const rows = await sql<Row[]>`
    select e.id::text as id, e.title, e.venue, e.source_url,
           (e.verified_at is not null) as verified,
           to_char(e.start_at at time zone 'America/Chicago','MM-DD') as day,
           to_char(e.start_at at time zone 'America/Chicago','YYYY-MM-DD') as iso
    from events e
    where e.status = 'published' and e.start_at > now()
      and e.source_url ~* '^https?://'
      ${HOST ? sql`and e.source_url ilike ${"%" + HOST + "%"}` : sql``}
    order by e.source_url, e.start_at`;

  // One fetch per DISTINCT url: 22 Three Rivers listings cite the same page.
  const byUrl = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byUrl.get(r.source_url) ?? [];
    list.push(r);
    byUrl.set(r.source_url, list);
  }
  const urls = [...byUrl.keys()].slice(0, LIMIT);
  console.log(
    `[sources] ${rows.length} live listings across ${byUrl.size} distinct pages; ` +
      `fetching ${urls.length}${APPLY ? "" : "   (DRY RUN — nothing is written)"}\n`,
  );

  const tally = { present: 0, absent: 0, unchecked: 0, pages: 0, failed: 0 };
  const misses: { row: Row; check: Extract<SourceCheck, { kind: "absent" }> }[] = [];

  for (const [i, url] of urls.entries()) {
    const group = byUrl.get(url)!;
    const got = await fetchText(url);
    tally.pages++;
    if ("error" in got) {
      tally.failed++;
      tally.unchecked += group.length;
      console.log(`  · ${new URL(url).hostname.replace(/^www\./, "")} — ${got.error} (${group.length} listing${group.length === 1 ? "" : "s"} unchecked)`);
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      continue;
    }
    for (const row of group) {
      const check = checkTitleOnPage(row.title, got.text, { day: row.iso });
      tally[check.kind]++;
      if (check.kind === "absent") {
        misses.push({ row, check });
        console.log(
          `  ✗ NOT ON ITS SOURCE  ${row.day} ${row.title.slice(0, 52)}${row.verified ? "  [was verified]" : ""}\n` +
            `      ${url}\n` +
            `      closest line on that page (${check.score}): "${check.best.slice(0, 96)}"`,
        );
      }
    }
    if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${urls.length} pages`);
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  if (APPLY && misses.length > 0) {
    for (const { row, check } of misses) {
      await sql`update events set verified_at = null, updated_at = now() where id = ${row.id}::uuid`;
      await sql`
        insert into admin_audit (action, event_id, patch)
        values ('verify_flag', ${row.id}::uuid, ${sql.json({
          verdict: "not_on_source",
          note:
            `the listing cites ${row.source_url} but its title is not on that page. ` +
            `Closest entry there (${check.score} of its distinctive words): "${check.best}"`,
          evidence: check.best,
          score: check.score,
          wasVerified: row.verified,
        })})`;
    }
  }

  console.log(
    `\n[sources] ${tally.pages} pages fetched (${tally.failed} unreadable) · ` +
      `present ${tally.present} · NOT ON SOURCE ${tally.absent} · unchecked ${tally.unchecked}` +
      (socketErrors > 0 ? ` · ${socketErrors} connection${socketErrors === 1 ? "" : "s"} dropped after the fact (survived)` : ""),
  );
  if (misses.length > 0) {
    console.log(
      APPLY
        ? `[sources] ${misses.length} flagged and un-verified — they now show in the ops digest queue and /admin/ops. Nothing was archived.`
        : `[sources] DRY RUN — re-run with --apply to flag these.`,
    );
  }
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[sources] fatal:", err);
  process.exitCode = 1;
});
