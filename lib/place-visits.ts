import { sql } from "./db";
import { placeBySlug } from "./places";

/**
 * "Been there" store (Places P5). The places twin of lib/saved.ts: every query
 * is explicitly scoped by the caller's anonymous saver token, so isolation
 * holds on the owner connection (which bypasses RLS); the RLS policy on
 * place_visits is the second layer for any other role.
 *
 * There is no foreign key — the registry lives in code — so validity is
 * enforced here: a slug is accepted only if it resolves in lib/places.ts.
 */

/** Above the registry size on purpose: someone who really does sweep every
 *  golf course must be able to finish. Drift-guarded against PLACES.length. */
export const VISITS_CAP = 1000;

const SLUG_RE = /^[a-z0-9-]{1,120}$/;

/** True only for a slug that exists in the registry (the analog of isValidUuid). */
export function isValidPlaceSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug) && placeBySlug(slug) !== null;
}

export async function isVisited(token: string, slug: string): Promise<boolean> {
  if (!sql || !isValidPlaceSlug(slug)) return false;
  const rows = await sql`
    select 1 from place_visits where user_token = ${token} and place_slug = ${slug} limit 1
  `;
  return rows.length > 0;
}

/** Check a place off for this token (idempotent, capped). Returns the visited state (true). */
export async function markVisited(token: string, slug: string): Promise<boolean> {
  if (!sql || !isValidPlaceSlug(slug)) return false;
  const [c] = await sql<{ n: number }[]>`
    select count(*)::int as n from place_visits where user_token = ${token}
  `;
  if ((c?.n ?? 0) >= VISITS_CAP) return true; // at cap — treat as already checked
  await sql`
    insert into place_visits (user_token, place_slug)
    values (${token}, ${slug})
    on conflict do nothing
  `;
  return true;
}

/** Uncheck a place for this token. Returns the visited state (false). */
export async function unmarkVisited(token: string, slug: string): Promise<boolean> {
  if (!sql || !isValidPlaceSlug(slug)) return false;
  await sql`
    delete from place_visits where user_token = ${token} and place_slug = ${slug}
  `;
  return false;
}

/** Every slug this token has checked off, newest first. Orphans (slugs no
 *  longer in the registry) come back too — the pure selectors ignore them. */
export async function getVisitedSlugs(token: string): Promise<string[]> {
  if (!sql) return [];
  const rows = await sql<{ place_slug: string }[]>`
    select place_slug
    from place_visits
    where user_token = ${token}
    order by visited_at desc
  `;
  return rows.map((r) => r.place_slug);
}

/**
 * ENGINEERING rule 1 (never-break for aux paths): the check-off list is an
 * addition to /saved and to the places pages, not their reason to exist. If
 * this read fails — the table not yet applied, a transient DB error — the
 * surface renders as it did before P5 (no section, no checks lit) instead of
 * a 500. The error is logged so it is not silent.
 */
export async function getVisitedSlugsSafe(token: string): Promise<string[]> {
  try {
    return await getVisitedSlugs(token);
  } catch (e) {
    console.error("[place-visits] read failed — rendering without check-offs:", e);
    return [];
  }
}
