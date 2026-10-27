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
  stalestFirst,
  pageLastChecked,
  pageNote,
  noteCategory,
  SWEEP_PAGE_BUDGET,
  type SourceCheck,
} from "../lib/source-presence";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const APPLY = process.argv.includes("--apply");
const LIMIT = Math.max(1, Number(arg("limit") ?? SWEEP_PAGE_BUDGET));
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
  /** When this listing's page was last actually read. Null = never. */
  source_checked_at: string | null;
};

/**
 * `status` travels alongside `error` so the note can tell a bot policy from a
 * dead link from a timeout. Before it did, every one of those was the same
 * `unchecked` and the proportions could only be found by probing 97 hosts by
 * hand — which is how they came to be reported wrongly. See `pageNote`.
 */
async function fetchText(
  url: string,
): Promise<{ text: string } | { error: string; status?: number; network?: string }> {
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
    if (!res.ok) return { error: `${res.status} ${res.statusText}`, status: res.status };
    const ct = res.headers.get("content-type") ?? "";
    if (!/html|text/i.test(ct)) return { error: `not a web page (${ct.split(";")[0] || "unknown type"})`, status: res.status };
    return { text: htmlToText(await res.text()) };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    const network = m.includes("abort") ? `no answer in ${TIMEOUT_MS / 1000}s` : m.slice(0, 60);
    return { error: network, network };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const sql = requireSql();

  /**
   * Record why a page landed where it did — and never let that kill the sweep.
   *
   * RULE 1. This is instrumentation on the instrument: the sweep's job is
   * checking sources, and saying why it could not is the aux path. The column
   * arrives by migration (`alter table events add column if not exists
   * source_check_note`), so between a deploy and that `alter` every one of these
   * writes fails — and check-sources is the LAST step of weekly-research with no
   * continue-on-error, so an unguarded write would fail the whole workflow and
   * take the ops digest's trigger with it. That is precisely the shape of the
   * four-week outage this instrument exists to report.
   *
   * It counts its own failures and the summary says so, because a note nobody
   * writes and nobody misses is how the last blind spot got made.
   */
  let noteFailures = 0;
  const note_ = async (note: string, ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await sql`update events set source_check_note = ${note} where id = any(${ids}::uuid[])`;
    } catch {
      noteFailures += ids.length;
    }
  };

  const rows = await sql<Row[]>`
    select e.id::text as id, e.title, e.venue, e.source_url,
           (e.verified_at is not null) as verified,
           to_char(e.start_at at time zone 'America/Chicago','MM-DD') as day,
           to_char(e.start_at at time zone 'America/Chicago','YYYY-MM-DD') as iso,
           e.source_checked_at::text as source_checked_at
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
  // Stalest first. Ordering by URL meant the same alphabetical head was checked
  // every week and the tail never was — see db/schema.sql on source_checked_at.
  const pages = [...byUrl.entries()].map(([url, group]) => ({
    url,
    lastChecked: pageLastChecked(group),
  }));
  const urls = stalestFirst(pages).slice(0, LIMIT);

  const never = pages.filter((p) => p.lastChecked === null).length;
  const runsToCover = Math.ceil(byUrl.size / LIMIT);
  console.log(
    `[sources] ${rows.length} live listings across ${byUrl.size} distinct pages; ` +
      `fetching ${urls.length} stalest (${never} never checked) · ` +
      `full sweep every ${runsToCover} run${runsToCover === 1 ? "" : "s"}` +
      `${APPLY ? "" : "   (DRY RUN — nothing is written)"}\n`,
  );

  const tally = { present: 0, absent: 0, unchecked: 0, pages: 0, failed: 0 };
  // Why each listing ended where it did, so the run reports its own blind spots
  // instead of leaving them to be probed by hand. See `pageNote`.
  const byNote = new Map<string, number>();
  const misses: { row: Row; check: Extract<SourceCheck, { kind: "absent" }> }[] = [];

  for (const [i, url] of urls.entries()) {
    const group = byUrl.get(url)!;
    const got = await fetchText(url);
    tally.pages++;
    if ("error" in got) {
      tally.failed++;
      tally.unchecked += group.length;
      const note = pageNote({ status: got.status, network: got.network });
      byNote.set(note, (byNote.get(note) ?? 0) + group.length);
      console.log(`  · ${new URL(url).hostname.replace(/^www\./, "")} — ${got.error} (${group.length} listing${group.length === 1 ? "" : "s"} ${note})`);
      // THE NOTE IS RECORDED EVEN THOUGH THE TIMESTAMP IS NOT. They answer
      // different questions — "when did we last read it" versus "what happened
      // last time we tried" — and it is the second one that was missing. A
      // blocked page must keep its null `source_checked_at` so it comes up
      // again next run, and must still be able to say that it is blocked.
      if (APPLY) await note_(note, group.map((r) => r.id));
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      continue;
    }
    const notes = new Map<string, string[]>();
    for (const row of group) {
      const check = checkTitleOnPage(row.title, got.text, { day: row.iso, venue: row.venue });
      tally[check.kind]++;
      const note = pageNote({ status: 200, check });
      byNote.set(note, (byNote.get(note) ?? 0) + 1);
      notes.set(note, [...(notes.get(note) ?? []), row.id]);
      if (check.kind === "absent") {
        misses.push({ row, check });
        console.log(
          `  ✗ NOT ON ITS SOURCE  ${row.day} ${row.title.slice(0, 52)}${row.verified ? "  [was verified]" : ""}\n` +
            `      ${url}\n` +
            `      closest line on that page (${check.score}): "${check.best.slice(0, 96)}"`,
        );
      }
    }
    if (APPLY) {
      // Stamped per page rather than in one batch at the end: a sweep that dies
      // at page 400 should keep the 399 it earned, or the next run repeats them.
      //
      // Only pages we actually READ are stamped. An unreadable one keeps its
      // null and comes up again next run, which is what you want from a dead
      // source: 41 of 593 were unreadable on 21 Sep and each is a real signal.
      //
      // ponytail: if unreadable pages ever approach --limit they would crowd
      // out every readable one and the sweep would stall without saying so.
      // Fine at 41/593; if that ratio climbs, stamp failures with a backdated
      // time so they retry ahead of fresh pages but behind nothing else.
      await sql`update events set source_checked_at = now()
                where id = any(${group.map((r) => r.id)}::uuid[])`;
      // The note varies per LISTING on a shared page — one title can be present
      // on it while another is absent — so these go one group per note, not one
      // per page.
      for (const [note, ids] of notes) await note_(note, ids);
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

  // WHERE THE UNVERIFIED ONES WENT. Without this the run reported one number
  // for four different problems, and the proportions had to be found by probing
  // 97 hosts by hand — which is how "177 blocked" got reported when the real
  // figure was 59, with 348 sitting on readable pages that are not dated
  // indexes because the venue draws its calendar with JavaScript.
  if (byNote.size > 0) {
    const groups = new Map<string, number>();
    for (const [note, n] of byNote) {
      const cat = noteCategory(note);
      groups.set(cat, (groups.get(cat) ?? 0) + n);
    }
    console.log("[sources] why each listing landed where it did:");
    if (noteFailures > 0) {
      console.log(
        `             (${noteFailures} notes could not be stored — is the source_check_note ` +
          `column migrated? the sweep itself was unaffected)`,
      );
    }
    for (const [cat, n] of [...groups].sort((a, b) => b[1] - a[1])) {
      const detail = [...byNote]
        .filter(([note]) => noteCategory(note) === cat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([note, c]) => `${note.slice(cat.length + 1) || "—"} ${c}`)
        .join(", ");
      console.log(`             ${String(n).padStart(4)}  ${cat.padEnd(12)} ${detail}`);
    }
  }
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
