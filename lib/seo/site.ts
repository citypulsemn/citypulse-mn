/** Canonical production origin — used for canonical URLs, sitemap, JSON-LD,
 *  ICS. R2.7: `www` is what Vercel actually serves (the apex 308-redirects to
 *  it — verified live Jul 20, 2026), so canonicals point straight at the
 *  200, not through a redirect hop. Matches SITE_URL in Vercel and Actions. */
export const SITE_URL = "https://www.citypulsemn.com";
