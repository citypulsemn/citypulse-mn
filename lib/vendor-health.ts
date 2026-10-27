/**
 * Is the stuff we don't own still working?
 *
 * WHY. Everything the ops digest reads lives in our own Postgres. Every
 * production incident this year lived somewhere else, and every one of them was
 * SILENT until something visible broke:
 *
 *   - Supabase egress ran over the plan; we found out via 402s.
 *   - Vercel Fluid Active CPU hit 4h16m against a 4h limit — a pause risk
 *     nobody was watching.
 *   - GitHub Actions drops roughly 60% of scheduled cron runs. A pipeline that
 *     never fired looks exactly like a quiet week.
 *   - The report-checker email never sent for days because an unset GitHub
 *     secret is "" and not undefined, so `??` never fell through.
 *   - The revalidation channel was dead for two months.
 *
 * So the job of this module is not to draw tiles. It is to make silence loud.
 *
 * THE RULE THAT MATTERS MOST: "we could not tell" is never green. A missing
 * token, a 500 from a vendor, a fetch that timed out — all render as `unknown`
 * and all COUNT AS SOMETHING TO LOOK AT. A dashboard that shows green when its
 * probe is broken is worse than no dashboard, because it actively buys your
 * silence. That is the same failure as a verify pass stamping a listing it
 * never actually checked, and it is the one this file is built to refuse.
 */

export type VendorStatus = "ok" | "warn" | "down" | "unknown";

export interface VendorTile {
  /** Display name, e.g. "Supabase". */
  service: string;
  status: VendorStatus;
  /** The number that matters, already formatted. Never empty. */
  headline: string;
  /** One line of context under the headline. Never empty. */
  detail: string;
  /** Where to go when the tile is not green. */
  link: string;
}

/** Ranked worst-first, so a dashboard can sort and so a summary can pick the top. */
export const STATUS_RANK: Record<VendorStatus, number> = { down: 0, warn: 1, unknown: 2, ok: 3 };

/** True when the tile is asking for attention. `unknown` counts — see the header. */
export function needsAttention(s: VendorStatus): boolean {
  return s !== "ok";
}

/** Worst status in a set. Empty set is `unknown`, not `ok`. */
export function worstStatus(tiles: { status: VendorStatus }[]): VendorStatus {
  if (tiles.length === 0) return "unknown";
  return tiles.reduce<VendorStatus>(
    (worst, t) => (STATUS_RANK[t.status] < STATUS_RANK[worst] ? t.status : worst),
    "ok",
  );
}

/**
 * A metered resource against its plan limit. Shared by Supabase egress and
 * Vercel CPU because the question is identical: how close to the cliff are we,
 * and is the month young or nearly over?
 *
 * `warnAt`/`downAt` are FRACTIONS of the limit. Default 0.8 / 1.0 — warn with a
 * fifth left, red once the plan is exceeded, because past the limit the vendor
 * decides what happens next, not us.
 */
export function judgeUsage(
  used: number | null | undefined,
  limit: number | null | undefined,
  opts: { warnAt?: number; downAt?: number } = {},
): VendorStatus {
  const warnAt = opts.warnAt ?? 0.8;
  const downAt = opts.downAt ?? 1;
  if (!Number.isFinite(used as number) || !Number.isFinite(limit as number)) return "unknown";
  const u = used as number;
  const l = limit as number;
  // A zero or negative limit tells us nothing about headroom — refuse to guess.
  if (l <= 0) return "unknown";
  if (u < 0) return "unknown";
  const frac = u / l;
  if (frac >= downAt) return "down";
  if (frac >= warnAt) return "warn";
  return "ok";
}

/**
 * A scheduled job that is supposed to fire on a period.
 *
 * Two separate failures, and the second is the one that kept catching us:
 *   1. It ran and FAILED — loud, easy.
 *   2. It never ran at all — silent, and the reason `expectEveryHours` exists.
 *
 * The grace multiplier is generous (2x period before warn) because GitHub's own
 * scheduler is late by up to an hour routinely; anything tighter cries wolf.
 */
export function judgeCron(
  lastRunIso: string | null | undefined,
  lastRunOk: boolean | null | undefined,
  expectEveryHours: number,
  now: Date,
): VendorStatus {
  if (!lastRunIso) return "unknown";
  const t = Date.parse(lastRunIso);
  if (Number.isNaN(t)) return "unknown";
  const hoursAgo = (now.getTime() - t) / 3_600_000;
  // A run from the future is a clock problem, not a health signal.
  if (hoursAgo < -1) return "unknown";
  if (hoursAgo > expectEveryHours * 2) return "down"; // two periods missed: it is not coming
  if (lastRunOk === false) return "down"; // it fired and failed
  if (hoursAgo > expectEveryHours * 1.25) return "warn"; // late
  if (lastRunOk == null) return "unknown"; // ran recently, but we can't tell if it passed
  return "ok";
}

/** Bytes → a human string. Used by the Supabase tile and its tests. */
export function formatBytes(n: number | null | undefined): string {
  if (!Number.isFinite(n as number) || (n as number) < 0) return "—";
  const b = n as number;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Minutes → "4h 16m". */
export function formatDuration(mins: number | null | undefined): string {
  if (!Number.isFinite(mins as number) || (mins as number) < 0) return "—";
  const m = Math.round(mins as number);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/**
 * The tile a probe produces when it could not run. Kept here rather than
 * written out at five call sites, so no probe can accidentally invent a
 * cheerier fallback for itself.
 */
export function unknownTile(service: string, reason: string, link: string): VendorTile {
  return {
    service,
    status: "unknown",
    headline: "not reported",
    detail: reason || "the check did not run",
    link,
  };
}

/**
 * One line summarising a set of tiles, for the top of the page and for a
 * subject line. Deliberately mirrors the ops digest's own "✅ all green /
 * ⚠️ N alerts" phrasing so the page and the email read the same.
 */
export function summarise(tiles: VendorTile[]): string {
  if (tiles.length === 0) return "no vendor checks configured";
  const bad = tiles.filter((t) => needsAttention(t.status));
  if (bad.length === 0) return `✅ all ${tiles.length} services green`;
  const named = bad
    .slice()
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    .map((t) => t.service)
    .join(", ");
  return `⚠️ ${bad.length} of ${tiles.length} need a look — ${named}`;
}

/**
 * Put a ceiling on anything that might not come back.
 *
 * WHY, and it is embarrassing: the first version of /admin/ops gave every
 * vendor probe a 6-second timeout and gave the PAGE none. `gatherOpsInputs`
 * fires roughly twenty queries in sequence and had no ceiling either, so on
 * 14 Sep 2026 the page simply span forever in production — the exact rule-1
 * failure this module's own header lectures about, committed one file away
 * from the lecture.
 *
 * Resolves with `fallback` rather than rejecting, because at every call site
 * "it did not answer in time" is the same answer as "it could not answer", and
 * that answer is `unknown` — never a spinner, and never a green tile.
 */
export async function withDeadline<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Did the weekly email actually go out?
 *
 * WHY IT IS A TILE. This has been reported in the Monday ops email all along,
 * as a line of prose several sections down. On 6 Aug 2026 a Thursday send was
 * missed — the only failed Actions run in the digest's history — and nobody
 * noticed, because the list was four people and the miss was a sentence in a
 * paragraph. A miss deserves the same red square a dead vendor gets.
 *
 * TWO DIFFERENT FAILURES, and the second is the quiet one:
 *   1. The last attempt FAILED — loud, and the note says why.
 *   2. No attempt happened at all — silent, and the only evidence is the age
 *      of the last success.
 *
 * `staleDays` is the email's own DIGEST_STALE_DAYS, passed in rather than
 * duplicated: the digest goes out Thursday and the ops report runs Monday, so
 * a healthy week reads 4 days and a single skipped send reads 11. If the tile
 * and the email ever disagreed about what "missed" means, one of them would be
 * lying to the same person on the same morning.
 */
export function judgeDigest(
  lastSuccessDaysAgo: number | null,
  lastAttemptFailed: boolean,
  staleDays: number,
): VendorStatus {
  if (lastAttemptFailed) return "down";
  if (lastSuccessDaysAgo === null) return "unknown"; // never sent, or unreadable
  if (!Number.isFinite(lastSuccessDaysAgo) || lastSuccessDaysAgo < 0) return "unknown";
  if (lastSuccessDaysAgo >= staleDays) return "down"; // a Thursday was missed
  // Two-thirds of the way to stale is the shoulder: a send is due about now.
  if (lastSuccessDaysAgo >= Math.floor(staleDays * 0.75)) return "warn";
  return "ok";
}

/**
 * What a PARTIAL cost measurement is allowed to claim.
 *
 * On 28 Sep 2026 the Anthropic tile read "$22.78 month to date" in green while
 * the console read $181.87. Nothing was broken: the tile sums `pipeline_runs`,
 * two of September's four runs predated the cost-recording code, and the
 * weekly verify pass — which spends for twenty to thirty minutes at a time —
 * records nothing anywhere. A floor was rendering as a total, and green said
 * the floor was fine.
 *
 * A measurement that knows it is missing rows must not read `ok`. That is the
 * same rule the rest of this file enforces about missing tokens; the only
 * difference here is that the blindness is partial, which makes it easier to
 * miss and worse when it lands.
 */
export function judgeCostCoverage(runs: number, priced: number): VendorStatus {
  if (!Number.isFinite(runs) || !Number.isFinite(priced) || priced < 0 || runs < 0) return "unknown";
  if (priced === 0) return "unknown"; // nothing priced: no floor at all, not a zero bill
  if (priced < runs) return "warn"; // a floor, and we know by how many rows it is short
  return "ok";
}

/* ------------------------------------------------- the weekly source sweep */

/** What `getSourceSweepHealth` measures. Counts are of PUBLISHED upcoming rows. */
export interface SourceSweepHealth {
  /** `max(source_checked_at)`, ISO, or null when nothing has ever been read. */
  newestIso: string | null;
  /** Pages stamped by the LATEST run — see `runWindowHours`. */
  pagesSwept: number;
  /** Distinct cited pages on the calendar right now. */
  pagesTotal: number;
  /** What one run may cover: `expectedPages(pagesTotal, budget)`. */
  pagesExpected: number;
  /** Listings whose cited page has never been read. A fact, never the verdict. */
  neverChecked: number;
  /** Listings in total, for the denominator. */
  listings: number;
  /**
   * How far back from the newest stamp still counts as "the same run".
   *
   * NOT a calendar window, and that distinction is the whole correctness of
   * `pagesSwept` — see `judgeSourceSweep`.
   */
  runWindowHours: number;
}

/** When a sweep is due. `cron: "0 6 * * 1"` is Monday 06:00 UTC. */
export interface SweepSchedule {
  everyHours: number;
  /** 0 = Sunday, as `Date.getUTCDay()` counts. */
  dueDayUTC: number;
  dueHourUTC: number;
}

/**
 * Below this share of a full run's budget, the sweep ran but barely read
 * anything. Far from a healthy run rather than close to it: a good week reads
 * nearly every page it is allowed to, ~90% once the hosts that refuse a script
 * are subtracted, so half is unmistakably partial and still never cries wolf.
 */
export const SWEEP_PARTIAL_AT = 0.5;

/**
 * What one run may cover. The budget binds once the calendar outgrows it: 593
 * pages against a 400-page budget means a healthy run reads 400, not 593, and
 * judging it against the whole calendar would report every good week as
 * two-thirds done.
 *
 * Pure, and here rather than inside the SQL module so a test can reach it.
 */
export function expectedPages(pagesTotal: number, budget: number): number {
  if (!Number.isFinite(pagesTotal) || !Number.isFinite(budget)) return 0;
  if (pagesTotal <= 0 || budget <= 0) return 0;
  return Math.min(budget, pagesTotal);
}

/**
 * The most recent moment the sweep was DUE, at or before `now`.
 *
 * WHY A SCHEDULE AND NOT A STOPWATCH. The first version of this alarm compared
 * elapsed time against the period, copying `judgeCron`. That is wrong for this
 * instrument because of WHERE it is read: the ops digest fires on
 * `workflow_run: completed` for Weekly Event Research, and `check-sources` is
 * the LAST STEP of that same workflow. So the email samples minutes after the
 * sweep should have run — which means on the first dead Monday the newest stamp
 * is almost exactly ONE period old, and a band that warns past 1.25 periods
 * reads `ok`. Measured before this was fixed: first dead Monday green, second
 * amber, third red. An alarm built to catch a four-week silence would have
 * stayed quiet through three weeks of it.
 *
 * Tightening the elapsed-time threshold cannot fix that, because the
 * `/admin/ops` tile samples the same judge MID-WEEK: a Sunday read is six days
 * after a perfectly healthy Monday run, so any threshold tight enough for the
 * email is a false alarm on the page.
 *
 * The question that is right at every sampling time is not "how long ago?" but
 * "has it run since it was last due?".
 */
export function lastDueAt(now: Date, s: SweepSchedule): Date {
  const slot = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), s.dueHourUTC, 0, 0, 0),
  );
  slot.setUTCDate(slot.getUTCDate() - ((slot.getUTCDay() - s.dueDayUTC + 7) % 7));
  // Standing before this week's slot, the last one due was a period earlier.
  if (slot.getTime() > now.getTime()) slot.setUTCDate(slot.getUTCDate() - 7);
  return slot;
}

/**
 * Parse a Postgres `timestamptz::text`, which `Date.parse` only half handles.
 *
 * The driver returns `2026-09-28 13:14:38.494716+00`, and V8 reads that only
 * through its lenient non-ISO path. The SAME instant written with a `T` is
 * `NaN`, because a bare `+00` offset is not valid ISO-8601:
 *
 *   Date.parse("2026-09-28 13:14:38.494716+00")  ->  ok
 *   Date.parse("2026-09-28T13:14:38.494716+00")  ->  NaN
 *
 * So the alarm worked by accident of formatting, and one normalising keystroke
 * anywhere upstream would have turned it into a permanently grey tile. It would
 * have failed safe — `unknown` alerts — but as an unexplained grey square, not
 * as the answer. Normalise instead of relying on the lenient path.
 */
export function parseStampMs(stamp: string): number {
  const s = String(stamp ?? "").trim();
  const iso = s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Date.parse(s) : t;
}

/**
 * How many scheduled sweeps have come and gone since the newest stamp. Null
 * when the stamp is missing, unreadable, or in the future.
 *
 * Zero whenever the sweep stamped something at or after the latest due moment —
 * true both minutes after a healthy run and all week long afterwards, so the
 * email and the mid-week tile agree without either being loosened.
 */
export function sweepsMissed(newestIso: string | null, now: Date, s: SweepSchedule): number | null {
  if (!newestIso) return null;
  const t = parseStampMs(newestIso);
  if (Number.isNaN(t)) return null;
  // A stamp from the future is a clock problem, not a health signal.
  if (t - now.getTime() > 3_600_000) return null;
  const due = lastDueAt(now, s).getTime();
  if (t >= due) return 0;
  const period = Math.max(1, s.everyHours) * 3_600_000;
  return 1 + Math.floor((due - t) / period);
}

/**
 * Has the source check actually swept, and did it cover a plausible slice?
 *
 * WHY, AND IT IS THE WORST SILENCE THIS PROJECT HAS HAD. On 29 Sep 2026 a `//`
 * comment inside a `sql` template killed `import-sports`, and because the two
 * steps behind it carried no `if: !cancelled()`, `check-sources` never ran
 * again. The free weekly fabrication check was dead for FOUR WEEKS. The newest
 * `source_checked_at` sat at 28 Sep the whole time and NOTHING READ THAT
 * COLUMN — `stalestFirst` sorts by it and no instrument judged it.
 *
 * The workflow conclusion *was* `failure` and the Actions tile *was* red, for
 * four Mondays, and neither produced action. So this is a separate instrument,
 * and its verdict goes in the Monday EMAIL: red that nobody opens is
 * indistinguishable from green, and what nobody opened was a page.
 *
 * TWO FAILURES, and the second is the one a freshness check alone would miss:
 *   1. It did not run — nothing stamped since the sweep was last due. Counted
 *      by `sweepsMissed`, which asks about the SCHEDULE rather than about
 *      elapsed time; `lastDueAt` carries the measurement that forced that.
 *   2. It ran and read almost nothing: died after a few pages, or every fetch
 *      was refused. Only pages actually READ are stamped, so the newest stamp
 *      goes fresh while coverage collapses.
 *
 * `pagesSwept` MUST BE ONE RUN'S WORK. The first version counted a fixed 8-day
 * window against a 7-day cadence, so it always carried the previous run's
 * stamps — and the two faults compounded: on the first dead Monday the stamp
 * was one period old (`ok` under the old bands) and `pagesSwept` was last
 * week's 372, so the email read "372 of 400 cited pages re-read" on a week when
 * zero pages were read. A lying alarm is worse than no alarm, and that is the
 * exact failure this file exists to refuse. It is anchored to the newest stamp
 * now.
 *
 * WHAT IS DELIBERATELY NOT A VERDICT. The share of the calendar never checked
 * is printed as a FACT and never sets the status. Around 177 listings sit
 * behind hosts that 403 a script — minnesotaorchestra.org, guthrietheater.org,
 * artsmia.org, ESPN — so never-checked cannot reach zero, and an alarm that is
 * permanently amber is one nobody reads.
 *
 * One missed sweep is `warn`, not `down`: it already counts as an alert and
 * reaches the subject line, and GitHub's scheduler drops runs routinely. Two
 * missed is not lateness, it is absence.
 */
export function judgeSourceSweep(
  h: SourceSweepHealth,
  schedule: SweepSchedule,
  now: Date,
): { status: VendorStatus; lines: string[] } {
  const coverage =
    Number.isFinite(h.listings) && h.listings > 0
      ? `${h.neverChecked} of ${h.listings} upcoming listings have never been checked` +
        ` (some hosts refuse a script — see docs/SOURCE-CHECK.md)`
      : "no upcoming listings to check — an empty calendar is Coverage's alarm, not this one";

  const verdict = (status: VendorStatus, first: string) => ({ status, lines: [first, coverage] });
  const every = Math.max(1, Math.round(schedule.everyHours / 24));
  const everyLabel = every === 1 ? "every day" : `every ${every} days`;

  const missed = sweepsMissed(h.newestIso, now, schedule);
  if (missed === null) {
    if (!h.newestIso) {
      return verdict("unknown", "no source check on record at all — cannot tell whether the sweep has ever run");
    }
    if (Number.isNaN(parseStampMs(h.newestIso))) {
      return verdict("unknown", `the last source check reads "${h.newestIso}", which is not a date`);
    }
    return verdict("unknown", "the last source check is stamped in the future — check the clock, not the sweep");
  }

  const days = Math.max(0, Math.round((now.getTime() - parseStampMs(h.newestIso!)) / 86_400_000));
  if (missed >= 2) {
    return verdict(
      "down",
      `⚠️ ${missed} scheduled sweeps missed — nothing source-checked for ${days} days, and it runs ${everyLabel}`,
    );
  }
  if (missed === 1) {
    return verdict(
      "warn",
      `⚠️ the scheduled sweep did not run — the newest check is ${days} days old, and it runs ${everyLabel}`,
    );
  }

  // It ran on schedule. Did it actually read anything?
  if (!Number.isFinite(h.pagesExpected) || h.pagesExpected <= 0) {
    return verdict("unknown", "the sweep ran on schedule, but there is no page budget to compare it against");
  }
  if (!Number.isFinite(h.pagesSwept) || h.pagesSwept < 0) {
    return verdict("unknown", "the sweep ran on schedule, but the pages it read could not be counted");
  }
  if (h.pagesSwept < h.pagesExpected * SWEEP_PARTIAL_AT) {
    return verdict(
      "warn",
      `⚠️ the latest sweep read only ${h.pagesSwept} of ${h.pagesExpected} pages` +
        " — it died early, or the hosts refused it",
    );
  }
  return verdict(
    "ok",
    `the latest sweep read ${h.pagesSwept} of ${h.pagesExpected} cited pages` +
      ` (${days === 0 ? "today" : `${days}d ago`})`,
  );
}
