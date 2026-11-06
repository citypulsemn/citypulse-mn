import type { EventRecord } from "./types";
import { MONTHS, spanEndISO, type Spannable } from "./dates";

/**
 * MULTI-DAY EVENTS & DUPLICATES (roadmap 4.4).
 *
 * The live calendar had "Woodbury Days" three times, "Prior Lake Days" three
 * times, "Slavic Experience Festival" three times, "Day Block Brewing Date
 * Night" four times. But those are NOT the same problem, and treating them the
 * same would break the site:
 *
 *   1. MULTI-DAY RUN — a festival that genuinely spans consecutive days. The
 *      pipeline stored one row per day, so a 9-day fair crowds out nine other
 *      events. Fix: collapse to ONE event with a date span ("Jul 20–28").
 *
 *   2. TRUE DUPLICATE — the same event found several times with different venue
 *      guesses ("Lenox Community Center" / "Westwood Hills Nature Center Area" /
 *      "St. Louis Park (venue TBA)"). The existing dedup only merges events
 *      within 250m of each other, so wildly different venue guesses slip past.
 *      Fix: same title + same day + same city ⇒ duplicate, regardless of distance.
 *
 *   3. LEGITIMATE RECURRENCE — a weekly date night or a theatre run. These are
 *      real, separate events on separate days. Fix: LEAVE THEM ALONE. Only
 *      *consecutive* days form a run; a weekly series does not.
 *
 * All of this is pure and unit-tested; the DB routines in lib/upsert.ts apply it.
 */

const DAY_MS = 86_400_000;

/**
 * Canonical title for grouping. Strips the noise the agents add when they find
 * the same event twice: years, "Weekend 1", "(Second Edition)", "2026", trailing
 * punctuation. Deliberately conservative — over-normalizing merges real events.
 */
export function normalizeRunTitle(title: string): string {
  return (title ?? "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ") // years
    .replace(/\bweekend\s*\d+\b/g, " ") // "Weekend 1"
    .replace(/\bweekend\s+[ivx]+\b/g, " ") // "Weekend V" — the Jul 20 pipeline wave
    .replace(/\bday\s*\d+\b/g, " ") // "Day 2"
    .replace(/\b(second|third|1st|2nd|3rd)\s+edition\b/g, " ")
    .replace(/\([^)]*\)/g, " ") // parentheticals
    // Trailing run-phrases after a dash: "— Final Weekends", "– continued
    // weekends", "— Opening Weekend". A WHITELIST, not a general dash-strip —
    // "— Labor Day Weekend" and "— Butter Sculptures" must keep their words
    // (those merge via the parent-child fold in planCollapse, or not at all).
    .replace(/\s*[—–-]\s*(?:(?:opening|closing|final|last|first|continued|ongoing)\s+)?weekends?(?:\s+only)?\s*$/g, " ")
    .replace(/\s*[—–-]\s*(?:final|last)\s+(?:days|week)\s*$/g, " ")
    .replace(/[—–-]+\s*$/g, " ")
    .replace(/[''`]/g, "") // possessives: "Sever's" → "severs" (not "sever s")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCityKey(city: string): string {
  return (city ?? "").toLowerCase().replace(/\bsaint\b/g, "st").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

export function dayOf(iso: string): string {
  return (iso ?? "").slice(0, 10);
}

function dayNumber(iso: string): number {
  return Math.floor(new Date(`${dayOf(iso)}T12:00:00Z`).getTime() / DAY_MS);
}

/** Grouping identity: same event, same town. */
export function runKey(ev: Pick<EventRecord, "title" | "city">): string {
  return `${normalizeRunTitle(ev.title)}|${normalizeCityKey(ev.city)}`;
}

/**
 * SPORTS SERIES ARE NOT RUNS. A homestand is the same title in the same city on
 * consecutive days — "St. Paul Saints vs. Columbus Clippers" appears seven days
 * straight on the live calendar — but each of those is a REAL, SEPARATE game.
 * Collapsing them would archive six real events. So for sports, only SAME-DAY
 * rows may cluster (a true duplicate of one game); a next-day row is always a
 * new game.
 */
/**
 * Categories where consecutive days are SEPARATE TICKETED EVENTS, never a run.
 *
 * Sports was here first, for the reason above. Music joined it on 29 Sep 2026:
 * the collapse was planning to fold five two-night stands — jeremy
 * messersmith, Sylvan Esso, The Suburbs, Angine de Poitrine, Phantom of the
 * Opera — into one span each. Every one of those pairs carried TWO DISTINCT
 * ticket_urls, which is the proof: a Friday show and a Saturday show are two
 * things you buy separately, and folding them leaves a reader who wants
 * Saturday clicking through to Friday's tickets.
 *
 * A genuine multi-day music festival is categorised "festival" and still folds.
 */
const PER_NIGHT = new Set(["sports", "music"]);

function maxGapFor(category: string | undefined): number {
  return PER_NIGHT.has(category ?? "") ? 0 : 1;
}

export interface RunCluster<T> {
  key: string;
  /** Events sorted by start, forming ONE consecutive run (gaps ≤ 1 day). */
  events: T[];
  startDay: string;
  endDay: string;
  /** True when the run covers more than one calendar day. */
  multiDay: boolean;
}

/**
 * Group events into consecutive-day runs.
 *
 * Two events join the same run only if they share a run key AND their days are
 * adjacent (gap of 0 or 1 day). A weekly series has 7-day gaps, so it never
 * collapses — which is exactly what protects "Day Block Brewing Date Night".
 */
export function groupRuns<
  T extends Pick<EventRecord, "title" | "city" | "start"> & { category?: string },
>(events: T[]): RunCluster<T>[] {
  const byKey = new Map<string, T[]>();
  for (const ev of events) {
    const k = runKey(ev);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(ev);
  }

  const clusters: RunCluster<T>[] = [];

  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    let current: T[] = [];

    for (const ev of sorted) {
      if (current.length === 0) {
        current = [ev];
        continue;
      }
      const prevDay = dayNumber(current[current.length - 1].start);
      const gap = dayNumber(ev.start) - prevDay;
      // Same day (a duplicate) or the next day (a continuing run) → same cluster.
      // Sports and music never continue across days: each game, and each
      // night of a stand, is its own separately ticketed event.
      if (gap <= maxGapFor(ev.category)) {
        current.push(ev);
      } else {
        clusters.push(makeCluster(key, current));
        current = [ev];
      }
    }
    if (current.length > 0) clusters.push(makeCluster(key, current));
  }

  return clusters;
}

function makeCluster<T extends Pick<EventRecord, "start">>(key: string, events: T[]): RunCluster<T> {
  const startDay = dayOf(events[0].start);
  const endDay = dayOf(events[events.length - 1].start);
  return { key, events, startDay, endDay, multiDay: startDay !== endDay };
}

/** Clusters worth acting on: more than one row means a collapse or a merge. */
export function collapsibleClusters<
  T extends Pick<EventRecord, "title" | "city" | "start"> & { category?: string },
>(events: T[]): RunCluster<T>[] {
  return groupRuns(events).filter((c) => c.events.length > 1);
}

// ── Collapse planning (span-aware; roadmap 4.4 continued, Jul 2026) ────────
//
// groupRuns clusters by START-day adjacency only, which has a blind spot the
// 2026-07-20 pipeline run exposed: once a festival is collapsed to ONE card
// with a multi_day_end span, that span is invisible to the next collapse pass.
// A fresh "Weekend V" row dated three weeks into the run looks like an
// isolated event (21-day gap from the survivor's START) and never merges.
// planCollapse fixes this by clustering on INTERVALS — a row joins a run when
// its days overlap or touch the run's whole span — and adds the parent-child
// fold ("Minnesota State Fair — Llama Costume Contest" inside the fair's run
// folds into the fair card; Taren's call, matching the COLLAPSE-1.1 plan).

export interface CollapseRow {
  id: string;
  title: string;
  city: string;
  category?: string;
  start: string;
  /** Day part of an existing multi_day_end span, when the row has one. */
  endDay?: string | null;
}

export interface CollapseAction {
  /** run = consecutive days collapsed; duplicate = same-day copies; fold = sub-event absorbed by parent. */
  kind: "run" | "duplicate" | "fold";
  keepId: string;
  title: string;
  startDay: string;
  endDay: string;
  /** Day to write as the survivor's multi_day_end, or null when no write is needed. */
  setEnd: string | null;
  archiveIds: string[];
}

interface CollapseCluster {
  titleKey: string;
  cityKey: string;
  sports: boolean;
  rows: CollapseRow[];
  startNum: number;
  endNum: number;
}

function rowEndNum(row: CollapseRow): number {
  const startNum = dayNumber(row.start);
  if (row.endDay && row.endDay > dayOf(row.start)) {
    return Math.floor(new Date(`${row.endDay}T12:00:00Z`).getTime() / DAY_MS);
  }
  return startNum;
}

/** Proper word-prefix: "minnesota state fair" extends to "minnesota state fair llama…". */
function isWordPrefix(shorter: string, longer: string): boolean {
  return longer.length > shorter.length && longer.startsWith(`${shorter} `);
}

/**
 * Plan the collapse for a set of published/draft rows. Pure — returns actions
 * (survivor, span to write, ids to archive); the DB layer applies them.
 *
 * Rules, in order of what they protect:
 *  - SPORTS never merge across days and never fold — every game is real.
 *  - Weekly series never merge: a 7-day gap between single-day rows always
 *    splits clusters. Only a row whose days touch a run's span (gap ≤ 1) joins.
 *  - Parent-child fold requires the child's ENTIRE interval inside the
 *    parent's span — a sub-event dated outside the festival's run stays live
 *    (conservative floor; the verify pass owns the ambiguous ones).
 *  - Survivor = earliest start; ties prefer the row that already carries the
 *    curated span, then the shorter (cleaner) title.
 *  - Spans only ever EXTEND (never shrink), from attested rows only.
 */
export function planCollapse(rows: CollapseRow[]): CollapseAction[] {
  // 1 — same-key interval clustering (span-aware groupRuns).
  const byKey = new Map<string, CollapseRow[]>();
  for (const row of rows) {
    const k = runKey(row);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(row);
  }

  let clusters: CollapseCluster[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(
      (a, b) => a.start.localeCompare(b.start) || rowEndNum(a) - rowEndNum(b),
    );
    const [titleKey, cityKey] = key.split("|");
    const perNight = sorted.some((r) => PER_NIGHT.has(r.category ?? ""));
    let current: CollapseRow[] = [];
    let curStart = 0;
    let curEnd = 0;

    const flush = () => {
      if (current.length > 0)
        clusters.push({ titleKey, cityKey, sports: perNight, rows: current, startNum: curStart, endNum: curEnd });
    };

    for (const row of sorted) {
      const s = dayNumber(row.start);
      // Sports rows are ALWAYS single-day intervals, even if the row carries a
      // (bad) multi_day_end: a corrupted span would otherwise absorb — and
      // archive — every real game the pipeline inserts inside its window,
      // defeating the sports rule from the inside. (Found Jul 20: 14 legacy
      // sports rows with spans written by the pre-reclassify collapse era.)
      const e = perNight ? s : rowEndNum(row);
      const gap = perNight ? 0 : 1; // sports/music: same-day only, as in groupRuns
      if (current.length > 0 && s <= curEnd + gap) {
        current.push(row);
        curEnd = Math.max(curEnd, e);
      } else {
        flush();
        current = [row];
        curStart = s;
        curEnd = e;
      }
    }
    flush();
  }

  // 2 — parent-child fold. Child cluster's interval fully inside a
  // prefix-related cluster's interval → absorb. Longest-key children first so
  // chains land in their ultimate parent.
  const folded = new Set<CollapseCluster>();
  const foldKinds = new Map<CollapseCluster, boolean>();
  const children = [...clusters].sort((a, b) => b.titleKey.length - a.titleKey.length);
  for (const child of children) {
    if (child.sports || folded.has(child)) continue;
    let parent: CollapseCluster | null = null;
    for (const cand of clusters) {
      if (cand === child || cand.sports || folded.has(cand)) continue;
      if (cand.cityKey !== child.cityKey) continue;
      const [a, b] = [cand.titleKey, child.titleKey];
      const related = isWordPrefix(a, b) || isWordPrefix(b, a);
      if (!related) continue;
      // The shorter of the two keys is the "parent name" — require substance.
      const shorter = a.length < b.length ? a : b;
      if (shorter.split(" ").length < 2) continue;
      const contains = cand.startNum <= child.startNum && cand.endNum >= child.endNum;
      if (!contains) continue;
      // Prefer the widest containing parent, then the shorter (cleaner) key.
      if (
        !parent ||
        cand.endNum - cand.startNum > parent.endNum - parent.startNum ||
        (cand.endNum - cand.startNum === parent.endNum - parent.startNum &&
          cand.titleKey.length < parent.titleKey.length)
      ) {
        parent = cand;
      }
    }
    if (parent) {
      parent.rows.push(...child.rows);
      folded.add(child);
      foldKinds.set(parent, true);
    }
  }
  clusters = clusters.filter((c) => !folded.has(c));

  // 3 — actions.
  const actions: CollapseAction[] = [];
  for (const cluster of clusters) {
    const rowsSorted = [...cluster.rows].sort(
      (a, b) =>
        dayOf(a.start).localeCompare(dayOf(b.start)) ||
        rowEndNum(b) - rowEndNum(a) || // ties: the row already carrying a span
        a.title.length - b.title.length, // then the cleaner title
    );
    const keep = rowsSorted[0];
    const extras = rowsSorted.slice(1);
    if (extras.length === 0) continue;

    const startDay = dayOf(keep.start);
    // Sports clusters never produce spans (see the interval guard above) —
    // without this, deduping a same-day pair where one row carries a legacy
    // bad span would write a fresh multi_day_end onto the survivor.
    const endNum = cluster.sports
      ? Math.max(...cluster.rows.map((r) => dayNumber(r.start)))
      : Math.max(...cluster.rows.map(rowEndNum));
    const endDay = new Date(endNum * DAY_MS).toISOString().slice(0, 10);
    const multiDay = endDay > startDay;
    const keepEnd = keep.endDay && keep.endDay > startDay ? keep.endDay : null;
    const setEnd = multiDay && (!keepEnd || keepEnd < endDay) ? endDay : null;

    actions.push({
      kind: foldKinds.get(cluster) ? "fold" : multiDay ? "run" : "duplicate",
      keepId: keep.id,
      title: keep.title,
      startDay,
      endDay,
      setEnd,
      archiveIds: extras.map((e) => e.id),
    });
  }
  return actions;
}

/** A live row and an incoming row, as the fold planner needs to see them. */
export interface RunFoldRow {
  id: string;
  title: string;
  city: string;
  category?: string;
  /** Chicago wall clock. */
  start: string;
  /** The row's OWN end_at, which is one of the two places a span lives. */
  end?: string | null;
  multiDayEnd?: string | null;
}

export interface RunFold {
  /** The incoming row that must not be inserted. */
  incomingId: string;
  /** The live run it is a re-find of. */
  keepId: string;
  /** A later last day the live run should be extended to, or null to leave it. */
  extendTo: string | null;
  /**
   * True when the keeper shares NO key with the incoming row and was matched
   * on title similarity alone — the fold a human may want to look at.
   */
  drift: boolean;
}

/**
 * Re-finds of a run that is already on the calendar.
 *
 * THE DEFECT THIS EXISTS FOR, measured 4 Nov 2026. A long run gets a NEW
 * published row on every weekly pipeline pass. `event_key` is
 * sha256(title|venue|start DAY) and the pipeline writes the day it FOUND the
 * show, so each pass mints a fresh identity the upsert cannot collide with:
 *
 *   Como Park Daily General Admission   Oct 10 → Nov 10
 *                                       Oct 17 → Nov 17     +7
 *                                       Oct 24 → Nov 24     +7
 *   Twelve Kinds of Ice   Oct 19, Oct 26, Nov 2 — all ending Nov 22
 *   Kunene and the King   Oct 10, Oct 15, Oct 29 — all ending Nov 8
 *
 * 13 productions, 43 live rows, 30 of them surplus. `dedupeByKey` sees distinct
 * keys; `withoutLiveDuplicates` loads only rows STARTING on an incoming day, so
 * it never meets the run; and `planCollapse` is handed `multi_day_end` alone,
 * so a run carried in `end_at` reads to it as a single day and 7 days of gap
 * refuses the cluster. Every existing gate misses this shape.
 *
 * WHY ONLY RUN → RUN. A single dated row inside a run is NOT folded here, and
 * that is deliberate rather than an omission. Those rows are the calendar's
 * coverage: a run longer than EXPAND_MAX_DAYS shows on its start day only, so
 * "Twelve Kinds of Ice – ASL-Interpreted Performance" on Nov 14 is the only
 * card a reader gets that day. Feeding true spans to planCollapse instead was
 * measured first and would have archived 35 rows including those dated
 * performances — more coverage lost than duplication removed. Whether a theatre
 * run should be one span or many dated rows is a product call; this function
 * does not make it.
 *
 * PER_NIGHT is refused outright, for the reason the set exists: consecutive
 * days of sport and music are separately ticketed events, never one run.
 *
 * Identity is `runKey` — imported, not restated. A second definition of "the
 * same event" is what let the other gates drift apart.
 */
/**
 * Every key one row may be recognised by. `runKey` first and unchanged; the
 * other repairs a NORMALISER artefact rather than guessing at similarity.
 *
 * Measured 4 Nov 2026: five live rows for one exhibit at the Minnesota
 * Children's Museum, the largest single duplication on the calendar.
 *
 *   Monsters on Vacation (Special Exhibit)                    runKey → "monsters on vacation"
 *   Monsters on Vacation – Special Exhibit                    runKey → "monsters on vacation special exhibit"
 *   Monsters on Vacation – Special Exhibit at Minnesota …     runKey → "… at minnesota childrens museum"
 *
 * The first two are the SAME WORDS, and they key apart for one reason only:
 * `normalizeRunTitle` deletes parenthetical CONTENTS. So a row is also indexed
 * under its title with parens UNWRAPPED rather than deleted, and those two
 * variants then share a key.
 *
 * This is not a similarity score — it equates only titles a reader would call
 * identically spelled. Similarity is a separate rule below (`DRIFT_MIN`), added
 * after this one and measured on its own; keeping them apart is what lets the
 * fold say which of the two matched it. Two further rules were measured and
 * DECLINED, both recorded in docs/deploy-history/DEPLOY-RUN-REFIND-FOLD.md:
 *
 *   - `planCollapse`'s `isWordPrefix` parent-child rule (the third row above,
 *     and the widening originally asked for). It renames the survivor on 3 of
 *     its 9 folds — this gate keeps the EARLIEST start, while planCollapse
 *     prefers the shorter key — and it absorbs a year-round Mall of America
 *     attraction into one of its own sub-shows.
 *   - stripping a trailing " at <the row's own venue>", which would have
 *     folded the third row too. Both rows strip their OWN venue, so they meet
 *     on the bare remainder and two DIFFERENT venues in one city can be
 *     equated: measured, "Festival of Trees at Mall of America" absorbs
 *     "Festival of Trees at Bloomington Center for the Arts". A word-count
 *     floor does not close it, because the three-word holiday names are
 *     exactly the colliding ones. 7 of 7 historical cross-venue folds were
 *     in fact correct, but a wrong one here is an event that silently never
 *     appears, and this project holds coverage loss to be worse than
 *     duplication. The cost of declining it: the Monsters cluster folds to
 *     two rows rather than one.
 *
 * The alias stays HERE rather than in `normalizeRunTitle`, and that matters:
 * unwrapping parens in the normaliser would also SPLIT pairs that merge today
 * ("Fair (Day Two)" keys to "fair" now and folds into its parent; unwrapped it
 * would not), changing `planCollapse`'s archiving in both directions. Here the
 * alias only ever ADDS a key, so nothing that matches today stops matching.
 */
function runAliasKeys(r: RunFoldRow): string[] {
  return [...new Set([runKey(r), runKey({ title: r.title.replace(/[()]/g, " "), city: r.city })])];
}

/**
 * How much of two normalised titles is the same words: shared / union of their
 * token sets (Jaccard), 0..1. Set-based, so it sees a REORDERING that no prefix
 * or alias rule can — "Sever's Fall Festival & Corn Maze" against "Sever's Corn
 * Maze & Fall Festival" scores 1.
 */
/**
 * Words this calendar uses to name a PART of a run rather than a run.
 *
 * NOT invented: taken from the 5,171 titles the project has published, by
 * counting what actually appears after the last dash or colon — where this
 * calendar puts a phase. "weekend" leads at 146, then "night" 76, "day" 59,
 * "opening" 59, "final" 31, "performance" 21, "matinee" 15, "part" 8. Words
 * that only ever name a whole event ("tour", "festival", "concert", "market")
 * are left out, as are place names.
 *
 * It errs toward INCLUSION, and that is the safe direction on purpose: a word
 * wrongly listed here refuses a fold, which leaves a duplicate card visible,
 * while a word missing from it folds a real sub-event into silence. "night" and
 * "day" are the uncomfortable entries — "Date Night" and "Labor Day" are whole
 * events — but the guard only fires between two multi-day runs whose titles are
 * otherwise the same and whose dates overlap, where the cost is one duplicate.
 */
const SUBEVENT_WORDS = new Set([
  "opening", "closing", "final", "finale", "premiere", "preview", "previews",
  "matinee", "matinees", "encore", "gala", "members", "sneak", "peek",
  "part", "phase", "edition", "session", "sessions", "hours",
  "weekend", "weekends", "week", "day", "days", "night", "nights",
  "performance", "performances", "first", "second", "third", "last", "only",
]);

/** Tokens in one normalised title and not the other, in either direction. */
function titleDiff(a: string, b: string): string[] {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  return [...A].filter((t) => !B.has(t)).concat([...B].filter((t) => !A.has(t)));
}

function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  // Two titles that normalise to nothing share no tokens and score 0, so the
  // drift rule can never fold on emptiness. The exact key still can, which is
  // a pre-existing hole: exactly one published row normalises to empty, titled
  // "@", and it is music with no span, so it is neither a run nor eligible and
  // cannot reach this code. (An earlier version of this comment claimed no such
  // row existed. It does.)
  return shared / (A.size + B.size - shared || 1);
}

/**
 * MID-STRING TITLE DRIFT — the shape no key, alias or prefix rule reaches.
 *
 * A key is exact and an alias repairs one punctuation artefact. Neither sees a
 * word changed in the MIDDLE of a title, which is how the same production
 * actually arrives twice:
 *
 *   Monsters on SUMMER Vacation (Special Exhibit)   May 23 → Jan 10    0.750
 *   Monsters on Vacation (Special Exhibit)          Aug 17 → Jan 10
 *
 *   Como … – Daily GENERAL Admission                Oct 10 → Nov 10    0.750
 *   Como … – Daily OPEN Admission                   Oct 24 → Nov 24
 *
 * WHERE 0.75 COMES FROM. Measured over every overlapping same-city published
 * run pair on the live calendar (125 runs; 116 pairs the key and alias do not
 * already fold), walking the whole band down to 0.30 rather than asserting a
 * number:
 *
 *   ≥ 0.75   6 pairs — every one a real duplicate, and every one at the same
 *            venue or at one venue spelled two ways.
 *   0.500    the pair this project has already established is WRONG:
 *            "Nickelodeon Universe Winter Break – Universe of Light Holiday
 *            Light Show" against "Nickelodeon Universe Winter Break" — an
 *            umbrella listing and a year-round attraction inside it.
 *   0.444    the first pair no reader would call one event: "The Santa
 *            Experience at Mall of America" and "Festival of Trees at Mall of
 *            America", which share nothing but "at mall of america".
 *
 * So the threshold sits a clear 0.25 above the nearest known-bad pair rather
 * than up against it. It is conservative, not tuned: 0.60 would fold five more
 * pairs that are also real duplicates (a third Fall Flower Show row, Como's
 * "Daily Zoo Visit", SEA LIFE's two admission listings) and would still meet
 * nothing wrong until 0.50. Widening it is a product call, and coverage loss is
 * the expensive direction here, so it stays where the evidence is unambiguous.
 *
 * Arithmetically 0.75 means: a word deleted from a four-word title (3 of 4
 * shared), a word added to a three-word one, or — since a substitution costs
 * two tokens — one word swapped in a title of six or more shared tokens. Both
 * cases above are swaps carried by a long venue prefix. A swap in a short title
 * ("Daily General Admission" on its own, 0.500) is NOT caught, deliberately.
 *
 * MID-STRING MEANS MID-STRING: a word APPENDED is refused. An adversarial
 * review caught the first draft folding "Fall Flower Show – Part 2 Opening"
 * onto "Fall Flower Show – Part 2" at 0.833 — and a trailing word is exactly
 * the parent/child shape, which reason 3 of the `isWordPrefix` declination was
 * paid for: a multi-day sub-event IS a run, so matching a prefix relation turns
 * "run → run only" into "run → run, plus any multi-day sub-event whose title
 * begins with its parent's", the class the coverage rule protects. So the drift
 * candidate refuses `isWordPrefix` in either direction, borrowing the same
 * helper `planCollapse` uses rather than restating the idea.
 *
 * That guard costs a fold that was CORRECT on identity, and the honest version
 * of this is worth stating: Como publishes no opening night for the Fall Flower
 * Show (verified against its own event sitemap and Como Friends' calendar on
 * 4 Nov 2026), so those two rows are one show. The gate declines them anyway,
 * because nothing in the data distinguishes that pair from a real sub-event —
 * "Opening" could as easily have been a ticketed preview — and here a wrong
 * fold costs an event that silently never appears. Measured on the live
 * calendar: 2 of 8 drift folds were this shape, both of them that one pair.
 * A STRICT TOKEN SUPERSET would have been the wrong guard: it also refuses
 * "Monsters on Vacation" ⊂ "Monsters on Summer Vacation", which is the deletion
 * this rule exists for.
 *
 * POSITION WAS THE WRONG TEST, AND THE FIRST GUARD ONLY HALF-CLOSED THIS.
 * `isWordPrefix` is a string test — `longer.startsWith(shorter + " ")` — so it
 * sees a word appended at the END of the normalised title and nothing else.
 * Move the same qualifier in front of a trailing " at <venue>" and it slips
 * past at an identical score. Reproduced against real live rows: incoming
 * "Festival of Trees Members Preview at Mall of America" is DECLINED onto its
 * parent "Festival of Trees at Mall of America", and "Handmade Holidays –
 * Makers Market Third Weekend at Midtown Global Market" onto its parent;
 * strip the venue tail from either and the prefix guard holds. That tail is on
 * **15 of 114 eligible live runs**, so this is an ordinary naming shape, not a
 * contrived one — and a declined insert is an event that silently never
 * appears, permanently, because next week's re-find folds again.
 *
 * I had measured this as speculative and written it up as a known limit, on the
 * wrong axis: I counted pairs that COLLIDE today (none did) instead of parents
 * whose naming shape ADMITS it (15). An adversarial review against the
 * committed code found it with the second measurement.
 *
 * So the second guard tests the WORDS instead of their position: refuse when
 * any token that differs between the two titles names a phase
 * (`SUBEVENT_WORDS`). Both guards stay — the vocabulary catches a qualifier
 * anywhere, and `isWordPrefix` still catches an appended word that is not in
 * the vocabulary, such as "Fall Flower Show 2".
 *
 * REFUSING EVERY TOKEN SUPERSET was the other option, and it is rejected
 * because it would drop the deletion this rule was built for:
 * {monsters, on, vacation} ⊂ {monsters, on, summer, vacation} is the same
 * relation as {winter, lights, at, the, arboretum} ⊂ {winter, lights, opening,
 * at, the, arboretum}. Nothing structural separates them, only whether the
 * extra word names a phase — which is why the vocabulary exists at all.
 *
 * VENUE IS NOT REQUIRED, and that is measured too: of the six folds, three are
 * between rows whose venue STRINGS differ for one venue — "Travail Kitchen and
 * Amusements" / "Travail Kitchen & Amusements", "Minnesota Children's Museum
 * (St Paul)" / "Minnesota Children's Museum". Venue spelling drift is part of
 * why these duplicates exist at all; requiring equality would decline half of
 * them. The city key still has to match, as it does for every other rule here.
 *
 * THE TITLE IS NOT REWRITTEN, AND THE KEEPER IS WHICHEVER ROW IS ALREADY LIVE.
 * Be exact about that: the earliest-start sort only chooses among several LIVE
 * candidates, and the incoming row never keeps, so for a two-row drift pair the
 * surviving title is simply the one found first. Replayed both ways on the real
 * calendar, "Fall Flower Show – Part 2" and "Fall Flower Show – Part 2 Opening"
 * each keep when the other arrives.
 *
 * So a drift fold can leave a month-long show titled "– Part 2 Opening". It
 * cannot make any title worse than one already published — both rows are live
 * today — but it does stop the better-named re-find from ever appearing again.
 * Choosing by title instead would drop an attested earlier start, the axis
 * readers plan around, and writing the other row's title onto the keeper is a
 * product call this function has no business making. So the fold does the
 * mechanical thing and REPORTS it: a drift fold is flagged in `admin_audit`
 * and named in the Monday ops email with both titles, where a correction can
 * fix the name. That read path was built before this widening precisely so this
 * could be the answer.
 */
const DRIFT_MIN = 0.75;

export function planRunFolds(live: RunFoldRow[], incoming: RunFoldRow[]): RunFold[] {
  const span = (r: RunFoldRow) =>
    spanEnd({ start: r.start, end: r.end ?? undefined, multiDayEnd: r.multiDayEnd ?? null } as Spannable);
  // Only a row that is ITSELF a run can be a re-find of one.
  const runs = (rows: RunFoldRow[]) =>
    rows
      .filter((r) => !PER_NIGHT.has(r.category ?? ""))
      .map((r) => ({ r, end: span(r) }))
      .filter((x): x is { r: RunFoldRow; end: string } => x.end !== null)
      .map((x) => ({
        r: x.r,
        from: dayNumber(x.r.start),
        to: dayNumber(x.end),
        endDay: dayOf(x.end),
        titleKey: normalizeRunTitle(x.r.title),
        cityKey: normalizeCityKey(x.r.city),
      }));

  const liveRuns = runs(live);
  if (liveRuns.length === 0) return [];
  const byKey = new Map<string, typeof liveRuns>();
  for (const l of liveRuns) {
    for (const k of runAliasKeys(l.r)) (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(l);
  }

  const out: RunFold[] = [];
  for (const inc of runs(incoming)) {
    // A run is indexed under several keys, and can also match by similarity, so
    // the same candidate arrives more than once. Deliberately NOT
    // de-duplicated: one fold is pushed per incoming row, and copies of one run
    // sort adjacently, so the keeper is the same either way. A `seen` set here
    // would be code no test could kill.
    const keys = new Set(runAliasKeys(inc.r));
    const candidates = [
      ...[...keys].flatMap((k) => byKey.get(k) ?? []),
      // Mid-string drift: same town, enough of the same words. Scanned rather
      // than indexed, because similarity has no key to look up — 123 live runs
      // against a weekly batch of ~120 is ~15k comparisons of already-
      // normalised token sets, measured at 1.3ms per incoming row.
      ...liveRuns.filter(
        (l) =>
          l.cityKey === inc.cityKey &&
          // A word APPENDED is the parent/child shape, not drift — and folding
          // it is the hole reason 3 of the isWordPrefix declination was paid
          // for. See DRIFT_MIN's docblock.
          !isWordPrefix(l.titleKey, inc.titleKey) &&
          !isWordPrefix(inc.titleKey, l.titleKey) &&
          // ...and isWordPrefix only sees a word appended at the END of the
          // string, so the same qualifier moved in front of a trailing
          // " at <venue>" slips past it. That tail is on 15 of 114 live runs,
          // so the shape is ordinary, not exotic. Refuse on the WORDS instead
          // of their position whenever one of them names a phase.
          !titleDiff(l.titleKey, inc.titleKey).some((t) => SUBEVENT_WORDS.has(t)) &&
          tokenOverlap(l.titleKey, inc.titleKey) >= DRIFT_MIN,
      ),
    ]
      // Overlapping day intervals, inclusive: a re-find that opens on the run's
      // closing day is the same run, not a new one.
      .filter((l) => l.from <= inc.to && inc.from <= l.to)
      .filter((l) => l.r.id !== inc.r.id)
      // The earliest run wins, then the longer one — the keeper planCollapse
      // would pick, so the two passes cannot disagree about which row survives.
      .sort((a, b) => a.from - b.from || b.to - a.to);
    const keep = candidates[0];
    if (!keep) continue;
    out.push({
      incomingId: inc.r.id,
      keepId: keep.r.id,
      // Never rewrite a span that already reaches far enough; the collapse
      // holds the same discipline with setEnd.
      extendTo: inc.to > keep.to ? inc.endDay : null,
      // Asked of the KEEPER rather than carried from the candidate list, which
      // a row can enter twice. One derivation cannot disagree with itself.
      drift: !runAliasKeys(keep.r).some((k) => keys.has(k)),
    });
  }
  return out;
}

/**
 * Ids whose STORED span the current rules would never have written.
 *
 * PER_NIGHT is enforced at write time only, and the set has grown twice:
 * sports from the start, music on 29 Sep 2026. Each time it grows, every span
 * already stored in the newly-added category becomes a fold the planner would
 * now refuse to make — and nothing reconciled them.
 *
 * planCollapse ALREADY disbelieves those spans: the perNight guard above
 * treats such a row as a single-day interval whatever multi_day_end says. The
 * site does not. It reads multi_day_end directly, so a two-night stand went on
 * rendering as one two-day event, and the second night's own card showed up
 * beside it on day two. Measured 28 Oct 2026: six music rows, still live 29
 * days after the rule changed.
 *
 * So the collapse pass heals the data instead of only declining to worsen it.
 * Nothing else writes multi_day_end, which is what makes a clear durable.
 */
export function staleSpanIds(rows: CollapseRow[]): string[] {
  return rows
    .filter((r) => PER_NIGHT.has(r.category ?? "") && (r.endDay ?? "") > dayOf(r.start))
    .map((r) => r.id);
}

// ── Display ───────────────────────────────────────────────────────────────

/**
 * The last day an event runs, from EITHER source of span:
 *  - `multiDayEnd`, set by the 4.4 collapse (row-per-day festivals), or
 *  - the event's own `end` when it lands on a later DATE than `start` — some
 *    events arrive as one row with a two-week `end_at` (a county fair on the
 *    live site rendered as "7 PM – 6 PM" because same-day time-range formatting
 *    was applied to a 13-day range).
 * Null for ordinary single-day events.
 */
export function spanEnd(ev: Spannable): string | null {
  // ONE COPY OF THE RULE (5 Nov 2026). This body was a second, hand-kept copy of
  // the derivation inlined in lib/dates.ts daysSpanned — each annotated as a
  // mirror of the other, which is how rule 5 kept getting broken. The rule now
  // lives in lib/dates.ts, which this module already imported for MONTHS, so
  // there is no cycle and nothing left to drift.
  return spanEndISO(ev);
}

/** True when an event spans more than one day. */
export function isMultiDay(ev: Spannable): boolean {
  return spanEnd(ev) !== null;
}

/** "Jul 20 – 28" or "Jul 30 – Aug 2". */
export function multiDayLabel(ev: Spannable): string {
  const a = new Date(`${dayOf(ev.start)}T12:00:00`);
  const b = new Date(`${dayOf(spanEnd(ev) ?? ev.start)}T12:00:00`);
  const left = `${MONTHS[a.getMonth()].slice(0, 3)} ${a.getDate()}`;
  // The same MONTH is not the same month when the YEARS differ. Without the
  // year check a run from 2026-05-23 to 2027-05-10 collapsed to "May 23 – 10",
  // a backwards-reading range, on every surface that prints this label —
  // including two that post off-site, where it cannot be corrected after the
  // fact. lib/reels/format.ts:55 already guards exactly this with
  // `sy === ey && sm === em`; this is the same guard, late. No live row hits it
  // today (23 cross-year runs, none of them same-month), so nothing on the site
  // changes — it is one date edit away from mattering.
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const right = sameMonth
    ? `${b.getDate()}`
    : `${MONTHS[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
  return `${left} – ${right}`;
}

/** Number of days an event runs (1 for a normal event). */
export function runLength(ev: Spannable): number {
  const end = spanEnd(ev);
  if (!end) return 1;
  return dayNumber(end) - dayNumber(ev.start) + 1;
}

/**
 * Does this event's TRUE run intersect the window [startKey, endKey]?
 *
 * The rolling-window half of rule 5, lifted out of lib/feeds.ts on 5 Nov 2026
 * so that `lib/collections.ts` could ask the same question. It could not import
 * the feeds copy: `feeds.ts` imports COLLECTIONS, so the dependency only runs
 * one way, and the rule has to live below both. That is the same shape as
 * `spanEndISO` moving into lib/dates.ts for `multiday`.
 *
 * WHY IT MATTERED: `selectCollection` filtered on the START DAY alone while
 * `selectFeedEvents` used the feeds copy of this, for the SAME CollectionSpec —
 * so /collections/<slug> and /feeds/<slug>.ics disagreed, with the indexed HTML
 * page under-reporting. The R1.5 page-versus-ICS shape, a second time.
 */
export function spansWindow(ev: Spannable, startKey: string, endKey: string): boolean {
  const first = dayOf(ev.start);
  const last = dayOf(spanEnd(ev) ?? ev.start);
  return first <= endKey && last >= startKey;
}

/**
 * Does this event occur on `dayKey`? A multi-day festival is happening on every
 * day it spans — so it should surface in "what's on today", not only on day one.
 */
export function spansDay(ev: Spannable, dayKey: string): boolean {
  const start = dayOf(ev.start);
  const end = spanEnd(ev);
  if (!end) return start === dayKey;
  return dayKey >= start && dayKey <= dayOf(end);
}
