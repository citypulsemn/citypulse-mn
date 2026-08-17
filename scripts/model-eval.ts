import { researchCategory, RESEARCH_MODEL } from "../lib/agents/research-agent";
import { dueWindows } from "../lib/horizon";
import { compareEventSets, missedEvents } from "../lib/model-eval";
import type { CategoryKey } from "../lib/types";

/**
 * Haiku-routing validation (cost brainstorm lever #3). For each candidate
 * category, run the SAME research request on the baseline (Sonnet 4.6) and the
 * candidate (Haiku 4.5) and compare coverage. Haiku is ~3× cheaper both ways
 * ($1/$5 vs $3/$15 per MTok); the only question is whether it holds coverage on
 * the structured/stable categories. Read-only — logs a comparison, writes no DB.
 * Run in Actions (where ANTHROPIC_API_KEY lives) and paste the output back.
 */

const BASELINE = RESEARCH_MODEL; // claude-sonnet-4-6
const CANDIDATE = "claude-haiku-4-5";
// The categories proposed for Haiku: structured, schedule/listing-driven work.
const DEFAULT_CATEGORIES: CategoryKey[] = ["sports", "family", "arts"];

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

async function main() {
  const argv = process.argv.slice(2).filter(Boolean) as CategoryKey[];
  const categories = argv.length > 0 ? argv : DEFAULT_CATEGORIES;

  const near = dueWindows(new Date()).find((w) => w.label === "near");
  if (!near) {
    console.log("[model-eval] no near window (unexpected); aborting.");
    return;
  }
  console.log(`[model-eval] baseline=${BASELINE} candidate=${CANDIDATE}`);
  console.log(`[model-eval] window ${near.startDate}..${near.endDate} (${near.maxSearchUses} searches)\n`);

  for (const category of categories) {
    let baseline, candidate;
    try {
      [baseline, candidate] = await Promise.all([
        researchCategory(category, near.startDate, near.endDate, near.maxSearchUses, BASELINE),
        researchCategory(category, near.startDate, near.endDate, near.maxSearchUses, CANDIDATE),
      ]);
    } catch (err) {
      console.log(`## ${category.toUpperCase()} — FAILED: ${String(err).slice(0, 160)}\n`);
      continue;
    }

    const cmp = compareEventSets(baseline, candidate);
    const verdict = cmp.recall >= 0.8 && cmp.candidate >= cmp.baseline * 0.8 ? "✅ HOLDS" : "⚠️ DROPS COVERAGE";
    console.log(`## ${category.toUpperCase()} — ${verdict}`);
    console.log(`   Sonnet ${cmp.baseline} events · Haiku ${cmp.candidate} events · both ${cmp.both}`);
    console.log(`   Haiku recall of Sonnet's coverage: ${pct(cmp.recall)} (missed ${cmp.missedByCandidate}, extra ${cmp.extraByCandidate})`);
    const missed = missedEvents(baseline, candidate).slice(0, 5);
    if (missed.length > 0) {
      console.log(`   Haiku missed (sample): ${missed.map((e) => e.title).join(" · ")}`);
    }
    console.log("");
  }

  console.log("[model-eval] done. ✅ HOLDS on a category = safe to route it to Haiku. Paste this block back to decide.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
