import { defineConfig } from "vitest/config";

/**
 * The app's own suite, and only it.
 *
 * There was no vitest config until 29 Oct 2026, so the default glob walked the
 * whole tree — including `.claude/worktrees/`, which holds full git worktrees of
 * this same repo. Every test existed four times over, and `npm test` reported
 * **9,970 passing where the repo has 2,869**. That number was quoted in two
 * deploy guides and two commit messages as evidence of a green gate.
 *
 * Two things were wrong with it, and the second is the dangerous one:
 *
 *  1. It read like growth and was duplication (CLAUDE.md's "2,290+ and rising"
 *     is the honest lineage of the real figure).
 *  2. A worktree holds a DIFFERENT commit. Its tests were gating this
 *     checkout's green run — so a stale or half-finished branch could have
 *     failed a run that this code passed, or passed one it failed. A test suite
 *     that reports on code you are not shipping is the same class of fault as
 *     the instruments in ENGINEERING.md: it rendered a partial, mixed
 *     measurement as a pass.
 *
 * Keep the upstream defaults and add `.claude` and `.next`.
 */
export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/.claude/**",
      "**/.next/**",
    ],
  },
});
