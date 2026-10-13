/**
 * Still-card generator — the weekly "Five places" feed post. Design and locked
 * decisions: docs/REELS-PUBLISH.md, "Still cards". Every choice (which kind,
 * which five, every word) is lib/reels/cards/places-card.ts, and every rule
 * about days and history is lib/reels/cards/card-day.ts; this file is glue.
 * No model call and no network: the card is built from the Places registry.
 *
 *   npm run cards                        today's card — does nothing unless
 *                                        today is a Wednesday
 *   npm run cards -- --preview=6         the next 6 Wednesdays, rendered into
 *                                        _card-previews. No manifest is
 *                                        written there, so a preview can
 *                                        never be published.
 *   npm run cards -- --date=2026-10-14   build a coming Wednesday's folder
 *                                        ahead, for a rehearsal
 *                                        (cards:publish -- --dry-run). It is
 *                                        NOT what will post: the publisher
 *                                        only posts a card built on its own
 *                                        day, and that morning's run rebuilds
 *                                        the folder.
 *
 * A real run always leaves a manifest.json in "{date}_card", built or skipped,
 * and emails what will post (or why nothing will) hours before the 11:45 slot.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chiDayKey } from "../../lib/clock";
import { renderFeedCardJpeg } from "../../lib/reels/card";
import {
  CARD_RECORD_FILE,
  buildCardManifest,
  cardProblems,
  cardWasPosted,
  isCardDay,
  nextCardDays,
  readCardHistory,
} from "../../lib/reels/cards/card-day";
import { buildPlacesCard } from "../../lib/reels/cards/places-card";
import { CARD_CATCH_UP, CARD_SLOT, type PlacesCard } from "../../lib/reels/cards/types";
import { swallowedFlagsMessage } from "../../lib/reels/cli";
import { cardDirFor, cardPreviewRoot, reelsOutRoot } from "../../lib/reels/paths";
import { sendOpsEmail } from "../../lib/reels/publish/notify";
import { loadManifest, slotReached } from "../../lib/reels/publish/publisher";

const argOf = (name: string): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

/** A mistake at the keyboard, not a crash: say so here, send no email. */
function usage(message: string): never {
  console.error(`[cards] ${message}`);
  process.exit(2);
}

/** A built card that fails its checks becomes an honest skip, never a post. */
function checked(card: PlacesCard): PlacesCard {
  const problems = cardProblems(card);
  if (problems.length === 0) return card;
  return {
    status: "skipped",
    reason: `card failed its checks: ${problems.join("; ")}`,
    considered: card.considered,
  };
}

const rowsOf = (card: PlacesCard): string[] =>
  (card.content?.events ?? []).map((e, i) => `${i + 1}. ${e.name}, ${e.details}`);

/**
 * What the email may promise depends on the clock: the publish task fires at
 * 11:45 and again at 18:30, and a card built after that has no run left.
 */
function whenItPosts(now: Date): string {
  if (!slotReached(CARD_SLOT, now)) {
    return `Posts to Instagram at ${CARD_SLOT} today, when the scheduled publish run fires (or when you run: npm run cards:publish).`;
  }
  if (!slotReached(CARD_CATCH_UP, now)) {
    return `${CARD_SLOT} has passed; the ${CARD_CATCH_UP} catch-up run posts it (or run: npm run cards:publish).`;
  }
  return `No scheduled publish run is left today. It posts only if you run: npm run cards:publish.`;
}

async function preview(fromDate: string, weeks: number) {
  const outDir = cardPreviewRoot();
  mkdirSync(outDir, { recursive: true });
  const { records, warnings } = readCardHistory(reelsOutRoot());
  for (const w of warnings) console.warn(`[cards] ${w}`);

  // Each previewed week feeds the next, so the 8-week rule shows as it will run.
  const history = records.filter((r) => r.postDate < fromDate);
  for (const postDate of nextCardDays(fromDate, weeks)) {
    const card = checked(buildPlacesCard(postDate, history));
    if (card.status !== "built" || !card.content || !card.record) {
      console.log(`[cards] ${postDate}: SKIPPED — ${card.reason}`);
      continue;
    }
    history.push(card.record);
    writeFileSync(path.join(outDir, `${postDate}.jpg`), await renderFeedCardJpeg(card.content));
    writeFileSync(
      path.join(outDir, `${postDate}.txt`),
      [card.content.header, ...rowsOf(card), "", `CAPTION: ${card.caption}`, "", `ALT: ${card.altText}`, ""].join("\n"),
      "utf8",
    );
    console.log(`[cards] ${postDate}: ${card.content.header}`);
    for (const row of rowsOf(card)) console.log(`          ${row}`);
  }
  console.log(`[cards] previews in ${outDir} — nothing here can be published`);
}

async function main() {
  // `npm run cards --preview=6` (no bare "--") would run as a real generation.
  const kept = swallowedFlagsMessage("cards", ["date", "preview"]);
  if (kept) usage(kept);

  const today = chiDayKey(new Date());
  const postDate = argOf("date") ?? today;
  try {
    nextCardDays(postDate, 1); // throws on anything that is not a real yyyy-mm-dd day
  } catch {
    usage(`--date must be a real date written yyyy-mm-dd, got "${postDate}"`);
  }

  const weeks = argOf("preview");
  if (weeks !== null) {
    const n = Number(weeks);
    if (!Number.isInteger(n) || n < 1 || n > 26) usage("--preview must be a whole number of weeks, 1 to 26");
    return preview(postDate, n);
  }

  if (!isCardDay(postDate)) {
    console.log(`[cards] ${postDate} is not a Wednesday — cards post on Wednesdays, nothing to do`);
    return;
  }
  if (postDate < today) usage(`--date=${postDate} is in the past`);

  const dir = cardDirFor(postDate);
  // The folder is the record of what went out. Rebuilding it after the post
  // would re-send "posts at 11:45" and could rewrite what the record says posted.
  if (cardWasPosted(dir)) {
    console.log(`[cards] ${postDate}: already posted — nothing rebuilt (${dir})`);
    return;
  }

  const { records, warnings } = readCardHistory(reelsOutRoot());
  const card = checked(buildPlacesCard(postDate, records));

  mkdirSync(dir, { recursive: true });
  const imageFile = path.join(dir, "card.jpg");
  const captionFile = path.join(dir, "caption.txt");
  const recordFile = path.join(dir, CARD_RECORD_FILE);

  const built = card.status === "built" && !!card.content && !!card.record;
  if (built) {
    writeFileSync(imageFile, await renderFeedCardJpeg(card.content!));
    writeFileSync(captionFile, `${card.caption}\n`, "utf8");
    writeFileSync(path.join(dir, "alt.txt"), `${card.altText}\n`, "utf8");
    writeFileSync(recordFile, JSON.stringify(card.record, null, 2) + "\n", "utf8");
  } else {
    // Nothing from an earlier run today may sit beside a manifest that says skipped.
    for (const stale of [imageFile, captionFile, path.join(dir, "alt.txt"), recordFile]) rmSync(stale, { force: true });
  }

  const manifest = buildCardManifest(
    postDate,
    new Date().toISOString(),
    built
      ? { status: "built", imageFile, captionFile, warnings }
      : { status: "skipped", reason: card.reason ?? "no reason recorded", warnings },
  );
  // "card" is read by people and by nothing else: the gate ignores it.
  writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ ...manifest, card: { kind: card.kind ?? null, considered: card.considered } }, null, 2) + "\n",
    "utf8",
  );
  for (const w of warnings) console.warn(`[cards] ${w}`);

  if (built) {
    console.log(`[cards] ${postDate}: built — ${card.content?.header}`);
    for (const row of rowsOf(card)) console.log(`          ${row}`);
  } else {
    console.log(`[cards] ${postDate}: SKIPPED — ${card.reason}`);
  }

  if (postDate !== today) {
    // Built ahead: the publisher refuses any card not generated on its own
    // day, so an email saying "posts at 11:45" would not be true.
    console.log(
      `[cards] built ahead for a rehearsal — this folder is NOT what will post; ` +
        `the ${postDate} morning run rebuilds it. Rehearse: npm run cards:publish -- --dry-run --date=${postDate}`,
    );
  } else {
    const flagged = warnings.map((w) => `Warning: ${w}`);
    const sent = await sendOpsEmail(
      built
        ? {
            subject: `Card for ${postDate}: ${card.content?.header} — posts at ${CARD_SLOT}`,
            lines: [
              ...rowsOf(card),
              "",
              card.caption ?? "",
              "",
              `${whenItPosts(new Date())} To stop it, delete card.jpg from the folder below, ` +
                `or put a file named HOLD in it (HOLD.txt works too):`,
              dir,
              ...flagged,
            ],
          }
        : {
            subject: `Card for ${postDate}: no card this week`,
            lines: [card.reason ?? "no reason recorded", "Nothing will post. Nothing is needed from you.", ...flagged],
          },
    );
    console.log(`[cards] email ${sent}`);
  }
  console.log(`[cards] done — ${dir}`);
}

main().then(
  () => process.exit(0),
  async (err) => {
    console.error("[cards] fatal:", err);
    // Say so at 6:30 rather than leave it to the 11:45 "no manifest" email —
    // and say the truth about the folder: a card from an earlier run today
    // is still there and still posts.
    const today = chiDayKey(new Date());
    const earlier = loadManifest(cardDirFor(today));
    const stands = earlier?.outcomes[0]?.status === "built" && earlier.window.start === today;
    await sendOpsEmail({
      subject: stands ? "Card generation crashed — the earlier card still stands" : "Card generation crashed — no card was built",
      lines: [
        err instanceof Error ? err.message : String(err),
        stands
          ? `The card built earlier today is still in ${cardDirFor(today)} and posts at its slot unless you delete card.jpg or add a HOLD file.`
          : "Nothing will post unless it is run again: npm run cards",
      ],
    });
    process.exit(1);
  },
);
