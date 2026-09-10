import { describe, it, expect, afterEach, vi } from "vitest";
import { revalidateSite } from "../revalidate-client";

/**
 * The redirect case, 10 Sep 2026. REVALIDATE_SECRET was set correctly in Vercel
 * AND in GitHub Actions, and the call still came back "401 missing Authorization
 * header". SITE_URL was the apex domain, the site 308s to www, and fetch drops
 * the Authorization header across a cross-origin redirect. It read as a wrong
 * key for as long as it took to run the request by hand.
 *
 * So: a redirect must never be followed here, and must name itself.
 */
const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllGlobals();
});

function stubFetch(res: Response) {
  const spy = vi.fn().mockResolvedValue(res);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("revalidateSite — redirects", () => {
  it("does not follow one, and says the header would be dropped", async () => {
    process.env.REVALIDATE_SECRET = "s3cret";
    process.env.REVALIDATE_URL = "https://citypulsemn.com";
    const spy = stubFetch(
      new Response(null, {
        status: 308,
        headers: { location: "https://www.citypulsemn.com/api/revalidate" },
      }),
    );

    const out = await revalidateSite("test");
    expect(out.ok).toBe(false);
    expect(out.status).toBe(308);
    expect(out.reason).toContain("https://www.citypulsemn.com/api/revalidate");
    expect(out.reason).toContain("dropped across a redirect");

    // The point of the fix: exactly one request, never chased to the new origin
    // with the bearer token attached.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("still reports a plain 401 as a 401 — a wrong key must stay legible", async () => {
    process.env.REVALIDATE_SECRET = "s3cret";
    process.env.REVALIDATE_URL = "https://www.citypulsemn.com";
    stubFetch(new Response('{"error":"bad token"}', { status: 401 }));

    const out = await revalidateSite("test");
    expect(out.ok).toBe(false);
    expect(out.status).toBe(401);
    expect(out.reason).toContain("bad token");
    expect(out.reason).not.toContain("redirect");
  });

  it("a blank secret is caught before any request is made", async () => {
    process.env.REVALIDATE_SECRET = "   ";
    const spy = stubFetch(new Response(null, { status: 200 }));
    const out = await revalidateSite("test");
    expect(out.ok).toBe(false);
    expect(out.reason).toContain("REVALIDATE_SECRET is not set");
    expect(spy).not.toHaveBeenCalled();
  });
});
