/**
 * EVERY WAY A FLAG CAN FAIL TO ARRIVE, each of which otherwise falls through to a
 * paid run: about $8.55 for verify, about $12 for the pipeline. This is the only
 * guard between a typo and a real bill.
 *
 * (a) npm swallowed it. `npm run verify --from=x.json` — no bare `--` — reaches
 *     the script with NO ARGUMENTS, so an intended free apply becomes a full paid
 *     pass. npm leaves the flag in the environment, which is how we tell.
 *
 *     `--dry-run` belongs on the list. An earlier version left it off, reasoning
 *     that npm's own `--dry-run` default would false-positive on every run.
 *     MEASURED on npm 11.16.0: a plain `npm run` exports no `npm_config_dry_run`
 *     at all, and a swallowed one exports `"true"` — so there is no false
 *     positive, and omitting it left the likeliest typo of the lot unguarded.
 *
 * (b) written with a space, or with no value — `--from verdicts.json`, `--from=`.
 *     A script reading `--name=value` sees neither, leaves the variable falsy and
 *     walks past the free paths into the paid one.
 *
 * (c) misspelled. `--form=x` or `--dryrun` matches nothing, so the first spends and
 *     the second turns a rehearsal into a real write. Anything not on the list is
 *     refused.
 *
 * ONE GAP THIS CANNOT CLOSE: a misspelled flag with no bare `--`, as in
 * `npm run pipeline --form=x`. npm swallows it and the name is unknowable from here,
 * so that form still reaches the paid run. Scheduled tasks use exact commands.
 */
export function flagProblem(
  argv: string[],
  env: Record<string, string | undefined>,
  script: string,
  valueFlags: readonly string[],
  boolFlags: readonly string[],
): string | null {
  for (const a of argv.slice(2)) {
    if (a.startsWith("--") && ![...valueFlags, ...boolFlags].includes(a.slice(2).split("=")[0])) {
      return `${a} is not a flag this script knows.`;
    }
  }
  for (const name of [...valueFlags, ...boolFlags]) {
    const flag = `--${name}`;
    const envKey = `npm_config_${name.replace(/-/g, "_")}`;
    if (env[envKey] && !argv.some((a) => a.startsWith(flag))) {
      return `npm swallowed ${flag}. Use the bare -- separator: npm run ${script} -- ${flag}${boolFlags.includes(name) ? "" : "=..."}`;
    }
  }
  for (const n of valueFlags) {
    if (argv.includes(`--${n}`)) {
      return `--${n} was written without a value. It needs an equals sign: --${n}=...`;
    }
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    if (hit !== undefined && hit.slice(n.length + 3).trim() === "") {
      return `--${n}= was given no value.`;
    }
  }
  return null;
}
