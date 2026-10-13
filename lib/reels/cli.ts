/**
 * `npm run reels:publish --dry-run` is NOT a dry run. Without the bare "--",
 * npm keeps the flag for itself and the script starts with no arguments at
 * all: a rehearsal becomes a real post, `--smoke` becomes a full paid run.
 *
 * npm does leave traces, two of them (npm 11, measured):
 *  - a flag npm does not own ends up in the environment as npm_config_<name>
 *    (`--dry-run`, `--date=…`, `--variant=…`, `--out=…`);
 *  - `--day=friday` reaches the script as a bare word, "friday".
 * A flag npm DOES own (`--only`) leaves nothing, so no reel script uses one.
 * Each script checks for both traces and refuses to run rather than guess.
 */
export function swallowedFlags(
  names: readonly string[],
  env: Record<string, string | undefined> = process.env,
): string[] {
  return names.filter((name) => env[`npm_config_${name.replace(/-/g, "_")}`] !== undefined);
}

/** Bare words on the command line: none of the reel scripts takes one. */
export function strayWords(argv: readonly string[] = process.argv.slice(2)): string[] {
  return argv.filter((a) => !a.startsWith("--"));
}

/** The refusal to print, or null when the command line reached the script intact. */
export function swallowedFlagsMessage(
  script: string,
  names: readonly string[],
  env: Record<string, string | undefined> = process.env,
  argv: readonly string[] = process.argv.slice(2),
): string | null {
  const kept = swallowedFlags(names, env).map((name) => `--${name}`);
  const stray = strayWords(argv);
  if (kept.length === 0 && stray.length === 0) return null;
  const what = [
    kept.length ? `npm kept ${kept.join(", ")} for itself` : "",
    stray.length ? `npm turned a flag into the bare word${stray.length > 1 ? "s" : ""} ${stray.map((w) => `"${w}"`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  return (
    `${what}, so "npm run ${script}" started as if no flags were typed. ` +
    `Nothing was done. Put "--" before the flags: npm run ${script} -- ${[...kept, "…"].join(" ")}`
  );
}
