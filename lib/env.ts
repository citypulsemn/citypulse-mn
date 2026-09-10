/**
 * Reading environment variables that might be blank.
 *
 * WHY. On 9 Sep 2026 a reader reported a wrong listing. The auto-checker ran,
 * got the right answer in 11 minutes, saved it — and the email telling Taren
 * never sent. The job exited 0. The line that did it:
 *
 *     const to = process.env.NOTIFY_TO ?? process.env.OPS_DIGEST_TO;
 *
 * `NOTIFY_TO` is not set. But a GitHub Actions workflow that maps
 * `NOTIFY_TO: ${{ secrets.NOTIFY_TO }}` for a secret that does not exist sets
 * the variable to the EMPTY STRING, not to undefined. `""` is not nullish, so
 * `??` returned `""` and never reached `OPS_DIGEST_TO`, which was set the whole
 * time.
 *
 * The same shape signed the one-tap decision links with an empty key under
 * Actions while Vercel — where the variable really is undefined — verified them
 * with the fallback. Different keys on the two ends; the buttons could never
 * have worked.
 *
 * So: blank is absent. Use these instead of `??` for anything that can arrive
 * from a CI secret.
 */

/** The first of `names` whose value is set and not blank. */
export function envValue(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

/** Like `envValue`, but with a literal default when none is set. */
export function envOr(fallback: string, ...names: string[]): string {
  return envValue(...names) ?? fallback;
}

/** For values with no safe default — throws naming every variable it tried, so
 *  a misconfiguration reads as a misconfiguration instead of a mystery. */
export function envRequired(...names: string[]): string {
  const v = envValue(...names);
  if (v === undefined) {
    throw new Error(
      `None of these environment variables is set: ${names.join(", ")}. ` +
        `Note that an unset GitHub Actions secret arrives as an empty string, ` +
        `which counts as unset here.`,
    );
  }
  return v;
}
