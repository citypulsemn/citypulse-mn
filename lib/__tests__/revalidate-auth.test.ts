import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkRevalidateAuth,
  parseRevalidateBody,
  MAX_EVENT_IDS,
} from "../revalidate-auth";

const SECRET = "s3cret-token-value";
const bearer = (t: string) => `Bearer ${t}`;
const ID = "df56fd30-7c5a-48ac-b08b-ee8d5bdf60a9";

describe("checkRevalidateAuth", () => {
  it("accepts the configured token", () => {
    expect(checkRevalidateAuth(bearer(SECRET), SECRET)).toEqual({ ok: true });
  });

  it("is case-insensitive about the scheme but not the token", () => {
    expect(checkRevalidateAuth(`bearer ${SECRET}`, SECRET).ok).toBe(true);
    expect(checkRevalidateAuth(bearer(SECRET.toUpperCase()), SECRET).ok).toBe(false);
  });

  it("FAILS CLOSED with 503 when no secret is configured", () => {
    // Mirrors middleware.ts denying /admin when ADMIN_PASSWORD is unset. An
    // endpoint that dumps every cache must not fall open on a missing env var.
    for (const missing of [undefined, "", "   "]) {
      const r = checkRevalidateAuth(bearer("anything"), missing);
      expect(r).toMatchObject({ ok: false, status: 503 });
    }
  });

  it("503 is distinguishable from 401 — misconfigured deploy vs wrong key", () => {
    expect(checkRevalidateAuth(bearer("wrong"), SECRET)).toMatchObject({ status: 401 });
    expect(checkRevalidateAuth(bearer("wrong"), undefined)).toMatchObject({ status: 503 });
  });

  it("rejects a missing or malformed header", () => {
    expect(checkRevalidateAuth(null, SECRET)).toMatchObject({ ok: false, status: 401 });
    expect(checkRevalidateAuth(SECRET, SECRET).ok).toBe(false); // no "Bearer "
    expect(checkRevalidateAuth("Basic abc", SECRET).ok).toBe(false);
  });

  it("a wrong-length token is rejected, not thrown on", () => {
    // timingSafeEqual throws on length mismatch; the length check must come first.
    expect(() => checkRevalidateAuth(bearer("short"), SECRET)).not.toThrow();
    expect(checkRevalidateAuth(bearer("short"), SECRET).ok).toBe(false);
    expect(checkRevalidateAuth(bearer(SECRET + "extra"), SECRET).ok).toBe(false);
  });

  it("never leaks the secret in the refusal reason", () => {
    const r = checkRevalidateAuth(bearer("wrong"), SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).not.toContain(SECRET);
  });
});

describe("parseRevalidateBody", () => {
  it("an empty body means bust everything", () => {
    for (const body of [null, undefined, {}, "nonsense", 42]) {
      expect(parseRevalidateBody(body)).toEqual({ eventIds: [], reason: "unspecified" });
    }
  });

  it("keeps well-formed uuids and drops everything else", () => {
    const { eventIds } = parseRevalidateBody({
      eventIds: [ID, "not-a-uuid", "", null, 7, `  ${ID}  `],
    });
    expect(eventIds).toEqual([ID, ID]);
  });

  it("bounds the id list so one call cannot do unbounded work", () => {
    const many = Array.from({ length: MAX_EVENT_IDS + 50 }, () => ID);
    expect(parseRevalidateBody({ eventIds: many }).eventIds).toHaveLength(MAX_EVENT_IDS);
  });

  it("carries a trimmed reason for the log", () => {
    expect(parseRevalidateBody({ reason: "  verify pass  " }).reason).toBe("verify pass");
    expect(parseRevalidateBody({ reason: "x".repeat(500) }).reason).toHaveLength(120);
    expect(parseRevalidateBody({ reason: "   " }).reason).toBe("unspecified");
  });
});

/**
 * The endpoint exists to give scripts the same reach that `refresh()` gives the
 * admin UI. If the two drift, a script-driven change would clear one cache layer
 * and not the other — which is the exact trap refresh()'s own comment warns
 * about: "pages re-render but re-read the still-cached getEvents() array".
 */
describe("the endpoint matches admin-actions' refresh()", () => {
  const ROOT = join(__dirname, "..", "..");
  const route = readFileSync(join(ROOT, "app/api/revalidate/route.ts"), "utf8");
  const admin = readFileSync(join(ROOT, "lib/admin-actions.ts"), "utf8");

  it("clears both layers, like refresh() does", () => {
    for (const src of [route, admin]) {
      expect(src).toMatch(/revalidateTag\(EVENTS_TAG\)/);
      expect(src).toMatch(/revalidatePath\("\/", "layout"\)/);
    }
  });

  it("busts named event pages the same way", () => {
    expect(route).toMatch(/revalidatePath\(`\/event\/\$\{id\}`\)/);
    expect(admin).toMatch(/revalidatePath\(`\/event\/\$\{id\}`\)/);
  });

  it("GET never revalidates — a prefetch must not dump the cache", () => {
    const get = route.slice(route.indexOf("export async function GET"));
    expect(get).not.toMatch(/revalidateTag|revalidatePath/);
    expect(get).toMatch(/405/);
  });
});
