import { computeEventKey } from "./event-key";
import { isAggregatorSource, isResaleSource } from "./source-trust";

/**
 * APPLYING AN ANSWER WE ALREADY HAVE.
 *
 * The verify pass flags a listing and proposes a fix; it never applies one,
 * because auto-editing a start time on a model's reading of a webpage risks
 * corrupting good data (lib/verify.ts). So roughly half the open flags carry a
 * ready-to-apply date or room taken from the venue's own calendar, and the only
 * way to act on them has been hand-written SQL per row. There is no
 * `/admin/flags` screen.
 *
 * THE PART THAT IS EASY TO GET WRONG, and the reason this is a module rather
 * than three UPDATEs: identity is `sha256(title | venue | start DATE)`, and
 * `event_key` is UNIQUE ACROSS EVERY STATUS. So editing a title, a venue or a
 * day changes the row's identity, and the new identity may already belong to
 * another row — including an archived or cancelled one you cannot see on the
 * site. Measured 18 Oct 2026: a flag said an Underoath date should move from
 * 12 Dec to 23 Nov, and the moved row's key came out byte-identical to an
 * already-published 23 Nov row whose title differed only by an en-dash. The
 * right action was not a date change at all; it was archiving a duplicate.
 *
 * `lib/admin-actions.ts updateEvent` recomputes the key — it was not doing so
 * for a while, and "every date correction quietly scheduled its own duplicate"
 * — but it does not check for a collision, and it cannot change coordinates. So
 * a venue move through it leaves the map pin at the old room.
 *
 * Pure here, IO in scripts/apply-correction.ts.
 */

/** A field-level fix for one listing, as an operator writes it. */
export interface Correction {
  id: string;
  /** Why this is being changed. Goes in the audit row; required, not decorative. */
  why: string;
  /** The page that settles it. */
  evidence?: string;
  /** Archive instead of editing — for a duplicate or a row that should go away. */
  archive?: boolean;
  /**
   * Hide instead of editing — the event page stops rendering.
   *
   * NOT a synonym for `archive`, and the difference is the whole point.
   * `getEvent` filters `status <> 'draft'`, so an ARCHIVED row keeps its event
   * page on purpose: something that really happened keeps the URL that went out
   * in a digest or a share. A FABRICATION never happened, and 28 Oct 2026 is how
   * that was learned — four re-dated 2025 sessions were archived, dropped off
   * every list, and went on serving their own pages, one of them for that
   * morning. `draft` is what `hideEvent` (lib/admin-actions.ts) and the one-tap
   * takedown in `/report-action` both set, and one update puts it back.
   */
  hide?: boolean;
  title?: string;
  venue?: string;
  city?: string;
  address?: string;
  /**
   * The page the listing cites.
   *
   * A citation is not a fact about the event, so changing it never touches
   * `verified_at` — but it does reset `source_checked_at`, or the source check
   * would treat the NEW page as recently read and leave it at the back of the
   * queue (`stalestFirst` in lib/source-presence.ts).
   *
   * Note this is NOT `evidence`. `evidence` is the page an operator read to
   * decide the correction and it goes in the audit row; `source_url` is what
   * the listing tells a reader and what the source check fetches every week.
   * Often they are the same page, and then both want setting.
   */
  source_url?: string;
  /** Chicago wall clock, `YYYY-MM-DDTHH:MM`. */
  start?: string;
  /** Chicago wall clock, or null to clear. */
  end?: string | null;
  lat?: number;
  lng?: number;
  /**
   * Did a primary source attest the CORRECTED values?
   *
   * Default false, which clears `verified_at`: a stamp left on a row whose date
   * just changed would claim a source vouched for the new date, when the source
   * is why it changed.
   *
   * Set true only when `evidence` is the organiser's own page showing exactly
   * these values — then the correction IS the verification, and clearing the
   * stamp would send the row back through a paid verify pass to re-establish a
   * fact already cited here. That pass costs about 5p a listing.
   */
  verified?: boolean;
}

/** The current row, as the script reads it. */
export interface CorrectionRow {
  id: string;
  event_key: string;
  title: string;
  venue: string;
  city: string;
  address: string;
  source_url: string;
  start_local: string;
  end_local: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
}

export type CorrectionPlan =
  | { kind: "archive"; id: string; why: string; evidence?: string }
  | { kind: "hide"; id: string; why: string; evidence?: string }
  | {
      kind: "edit";
      id: string;
      why: string;
      evidence?: string;
      /** Only the fields that actually differ. */
      fields: Partial<Record<keyof CorrectionRow, string | number | null>>;
      /** Non-null when identity changed and must be rewritten. */
      newKey: string | null;
      /** Human-readable `field: old → new`, for the log and the audit row. */
      changed: string[];
      /**
       * Did the citation change, so that `source_checked_at` must go back to
       * null?
       *
       * Lives on the plan rather than in the script because it is a decision,
       * not plumbing: leaving the old stamp would tell `stalestFirst` the new
       * page was read this week, and a page that is never re-read is a page
       * whose listing is never checked again.
       */
      resetsSourceCheck: boolean;
      /**
       * Does this change touch anything the verify pass actually checks?
       *
       * The pass is given title, venue, city and start (`VerifiableEvent`) and
       * asks whether the event is real on that date at that place. So moving a
       * map pin or fixing an address spelling does NOT invalidate a stamp —
       * and clearing it anyway would push the row back into a queue that costs
       * about 5p a listing to work, to re-establish a fact the correction never
       * touched. 95 listings needed their pin corrected on 18 Oct 2026; that is
       * the whole verify budget for a week, spent on nothing.
       */
      affectsVerification: boolean;
    }
  | { kind: "nothing"; id: string; why: string; note: string };

/**
 * The fields the verify pass is shown, and therefore the only ones whose change
 * can invalidate its stamp. `address`, `lat` and `lng` are deliberately absent:
 * the pass never sees them.
 */
const VERIFY_RELEVANT = ["title", "venue", "city", "start_local", "end_local"] as const;

const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Problems an operator's correction file can have, in plain words. */
export function validateCorrection(c: Correction): string | null {
  if (!c.id?.trim()) return "no id";
  if (!c.why?.trim()) return "no `why` — the audit row has to say why this changed";
  // They set different statuses, so a file asking for both is a file whose
  // author has not decided which one they mean.
  if (c.archive && c.hide) return "archive:true and hide:true are different outcomes — pick one";
  if (c.archive || c.hide) {
    const edits = (
      ["title", "venue", "city", "address", "source_url", "start", "end", "lat", "lng"] as const
    ).filter((k) => c[k] !== undefined);
    if (edits.length > 0) {
      const lever = c.archive ? "archive" : "hide";
      return `${lever}:true cannot be combined with edits (${edits.join(", ")})`;
    }
    return null;
  }
  // A stamp has to rest on something. `verified: true` without a cited page is
  // the laundering this project keeps finding: a confirmation with no source.
  if (c.verified && !(c.evidence ?? "").trim()) {
    return "verified:true needs `evidence` — a stamp with no cited page is the thing we keep catching";
  }
  // A pin fix cannot verify an event. The pass never sees lat/lng or address, so
  // `verified` on a change that touches only those would claim a confirmation
  // nothing established — and the stamp is left untouched there anyway.
  if (
    c.verified &&
    !["title", "venue", "city", "start", "end"].some((k) => c[k as keyof Correction] !== undefined)
  ) {
    return "verified:true on a change the verify pass cannot see (pin, address or citation only) — the stamp is left as it is for those";
  }
  // THE CITATION HAS TO BE AN IMPROVEMENT. This field exists to repair a bad
  // source, so pointing it at the two kinds of page the project has already
  // been burned by is refused rather than merely warned about:
  //   - a roundup, because `statusForNewEvent` will not publish on one, and a
  //     seasonal list's content is replaced under a stable URL every year.
  //   - a fake-venue reseller, because on 29 Sep 2026 seven live listings sent
  //     readers to one at a markup, all seven stamped verified.
  // A social page IS allowed. `isNonScheduleSource` is documented as good
  // enough to cite and not good enough to verify on, and `source_url` never
  // stamps anything. Note the two lists OVERLAP: eventbrite.com is in both, so
  // an Eventbrite page is refused by the roundup rule above even though it is
  // also a directory. That is the existing policy, not a new one — a host in
  // AGGREGATOR_HOSTS is one `statusForNewEvent` already will not publish on.
  // `String(...)` because corrections arrive from JSON.parse of an operator's
  // file, where `"source_url": null` is one keystroke away and is not the typed
  // shape. Reading `.slice` off it threw out of `validateCorrection`, which runs
  // inside a flatMap — so one typo abandoned every other correction in the file.
  if (c.source_url !== undefined) {
    const url = String(c.source_url).trim();
    if (!/^https?:\/\/[^\s/]+\.[^\s/]/i.test(url)) {
      return `source_url "${url.slice(0, 60)}" is not an http(s) URL with a host`;
    }
    if (isAggregatorSource(url)) {
      return `source_url ${url.slice(0, 60)} is a third-party roundup — cite the organiser's own page, which is the defect this field exists to fix`;
    }
    if (isResaleSource(url)) {
      return `source_url ${url.slice(0, 60)} is a reseller dressed up as the venue — never send a reader there`;
    }
  }
  if (c.start !== undefined && !WALL.test(c.start)) return `start "${c.start}" is not YYYY-MM-DDTHH:MM`;
  if (c.end !== undefined && c.end !== null && !WALL.test(c.end)) return `end "${c.end}" is not YYYY-MM-DDTHH:MM`;
  if (c.start && c.end && c.end < c.start) return `end ${c.end} is before start ${c.start}`;
  // A venue move with no coordinates leaves the pin at the old room — a reader
  // sent to the wrong address is worse than a listing with the old venue name.
  if (c.venue !== undefined && (c.lat === undefined || c.lng === undefined)) {
    return "a venue change needs lat and lng too, or the map pin stays at the old room";
  }
  if ((c.lat === undefined) !== (c.lng === undefined)) return "lat and lng go together";
  if (c.lat !== undefined && (c.lat < 43 || c.lat > 49.5)) return `lat ${c.lat} is outside Minnesota`;
  if (c.lng !== undefined && (c.lng < -97.5 || c.lng > -89)) return `lng ${c.lng} is outside Minnesota`;
  const touches = (
    ["title", "venue", "city", "address", "source_url", "start", "end", "lat", "lng"] as const
  ).some((k) => c[k] !== undefined);
  if (!touches) return "nothing to change";
  return null;
}

/**
 * What this correction would do to this row. Reports `nothing` when the row
 * already matches — re-running a correction file must be a no-op, not a second
 * audit row claiming a change.
 */
export function planCorrection(row: CorrectionRow, c: Correction): CorrectionPlan {
  if (c.archive) {
    if (row.status === "archived") {
      return { kind: "nothing", id: c.id, why: c.why, note: "already archived" };
    }
    return { kind: "archive", id: c.id, why: c.why, evidence: c.evidence };
  }
  if (c.hide) {
    if (row.status === "draft") {
      return { kind: "nothing", id: c.id, why: c.why, note: "already hidden" };
    }
    return { kind: "hide", id: c.id, why: c.why, evidence: c.evidence };
  }

  const fields: Partial<Record<keyof CorrectionRow, string | number | null>> = {};
  const changed: string[] = [];
  const put = (
    key: keyof CorrectionRow,
    next: string | number | null | undefined,
    current: string | number | null,
  ) => {
    if (next === undefined) return;
    if (next === current) return;
    fields[key] = next;
    changed.push(`${key}: ${current ?? "(none)"} → ${next ?? "(none)"}`);
  };

  put("title", c.title, row.title);
  put("venue", c.venue, row.venue);
  put("city", c.city, row.city);
  put("address", c.address, row.address);
  put("source_url", c.source_url, row.source_url);
  put("start_local", c.start, row.start_local);
  put("end_local", c.end, row.end_local);
  put("lat", c.lat, row.lat);
  put("lng", c.lng, row.lng);

  if (changed.length === 0) {
    return { kind: "nothing", id: c.id, why: c.why, note: "the row already says this" };
  }

  // Identity is title | venue | start DATE. A time-only change keeps the key,
  // which is deliberate: `computeEventKey` uses the DAY so a corrected start
  // time still matches on the next pipeline run.
  const nextTitle = c.title ?? row.title;
  const nextVenue = c.venue ?? row.venue;
  const nextStart = c.start ?? row.start_local;
  const nextKey = computeEventKey(nextTitle, nextVenue, nextStart);
  return {
    kind: "edit",
    id: c.id,
    why: c.why,
    evidence: c.evidence,
    fields,
    newKey: nextKey === row.event_key ? null : nextKey,
    changed,
    affectsVerification: VERIFY_RELEVANT.some((k) => k in fields),
    resetsSourceCheck: "source_url" in fields,
  };
}

/**
 * The value to write for one field: PRESENCE in the plan decides, never the
 * value itself.
 *
 * `fields` only carries keys whose value actually DIFFERS from the row (see
 * `put`), so an absent key means "leave it alone". The script used to write
 * `fields.end_local ?? row.end_local`, and `??` cannot tell "clear this" from
 * "not mentioned": a correction of `{"end": null}` on a row with an end time
 * evaluated `null ?? "2026-10-23T23:00"` and wrote the OLD timestamp straight
 * back. `end_at` could therefore never be cleared — and every piece of evidence
 * said it had been, because `describePlan` printed `end_local: 2026-10-23T23:00
 * → (none)` and the audit row stored that same line. `end_local` is in
 * VERIFY_RELEVANT, so the row also lost its `verified_at` to a change that did
 * not happen, and re-running the file rewrote the same lie every time.
 *
 * The golden test named "can clear an end time without clearing it by accident"
 * was green throughout: it asserted the PLAN, and the plan was always right.
 * Found 27 Oct 2026 by an adversarial review of the `source_url` change, which
 * edits the same UPDATE. `source_url` escaped it only because that column is
 * `not null default ''` and so is never cleared.
 */
export function nextValue(
  fields: Partial<Record<keyof CorrectionRow, string | number | null>>,
  row: CorrectionRow,
  key: keyof CorrectionRow,
): string | number | null {
  if (key in fields) return fields[key] ?? null;
  return row[key] as string | number | null;
}

/** One block of log lines per plan. */
export function describePlan(plan: CorrectionPlan, row: CorrectionRow): string[] {
  const head = `${row.title.slice(0, 54)} — ${row.start_local} @ ${row.venue.slice(0, 28)}`;
  if (plan.kind === "nothing") return [`· ${head}`, `    no change: ${plan.note}`];
  if (plan.kind === "archive" || plan.kind === "hide") {
    const label = plan.kind === "archive" ? "✗ ARCHIVE " : "⊘ HIDE    ";
    return [`${label} ${head}`, `    ${plan.why}`, ...(plan.evidence ? [`    ${plan.evidence}`] : [])];
  }
  return [
    `± EDIT     ${head}`,
    ...plan.changed.map((c) => `    ${c}`),
    ...(plan.newKey ? [`    event_key: ${row.event_key} → ${plan.newKey}  (identity changed)`] : []),
    `    ${plan.why}`,
    ...(plan.evidence ? [`    ${plan.evidence}`] : []),
  ];
}
