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

/**
 * Email deliverability. Bounces matter more than volume: a bounce rate climbing
 * past a couple of percent is how a sending domain's reputation dies, and the
 * weekly digest is the retention asset.
 */
export function judgeDelivery(
  sent: number | null | undefined,
  bounced: number | null | undefined,
  opts: { warnRate?: number; downRate?: number } = {},
): VendorStatus {
  const warnRate = opts.warnRate ?? 0.02;
  const downRate = opts.downRate ?? 0.05;
  if (!Number.isFinite(sent as number) || !Number.isFinite(bounced as number)) return "unknown";
  const s = sent as number;
  const b = bounced as number;
  if (s < 0 || b < 0) return "unknown";
  // Nothing sent is not "healthy delivery" — there is no evidence either way.
  if (s === 0) return "unknown";
  const rate = b / s;
  if (rate >= downRate) return "down";
  if (rate >= warnRate) return "warn";
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
