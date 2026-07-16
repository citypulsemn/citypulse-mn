import { describe, it, expect } from "vitest";
import {
  makeRestoreToken,
  verifyRestoreToken,
  restoreUrl,
  RESTORE_TTL_DAYS,
} from "../restore-token";
import { makeUnsubToken } from "../unsubscribe-token";
import { renderRestoreEmail } from "../saved-restore";

const SECRET = "test-secret";
const NOW = new Date("2026-07-15T12:00:00Z");
const FUTURE = Math.floor(NOW.getTime() / 1000) + 3600;

describe("restore token — the security surface", () => {
  it("round-trips a valid, unexpired token", () => {
    const t = makeRestoreToken(42, FUTURE, SECRET);
    expect(verifyRestoreToken(42, FUTURE, t, SECRET, NOW)).toBe(true);
  });

  it("EXPIRES: the same token fails one second past exp", () => {
    const t = makeRestoreToken(42, FUTURE, SECRET);
    const after = new Date((FUTURE + 1) * 1000);
    expect(verifyRestoreToken(42, FUTURE, t, SECRET, after)).toBe(false);
  });

  it("rejects tampered id, exp, or token", () => {
    const t = makeRestoreToken(42, FUTURE, SECRET);
    expect(verifyRestoreToken(43, FUTURE, t, SECRET, NOW)).toBe(false); // other user
    expect(verifyRestoreToken(42, FUTURE + 9999, t, SECRET, NOW)).toBe(false); // stretched expiry
    expect(verifyRestoreToken(42, FUTURE, t.slice(0, -2) + "xx", SECRET, NOW)).toBe(false);
    expect(verifyRestoreToken(42, NaN, t, SECRET, NOW)).toBe(false);
    expect(verifyRestoreToken(42, FUTURE, "", SECRET, NOW)).toBe(false);
  });

  /**
   * CROSS-PURPOSE REPLAY: unsubscribe links are public-ish (they sit in every
   * email footer, forever). The purpose namespace guarantees one can never be
   * replayed as a restore token for the same subscriber id — even though both
   * token families share a secret.
   */
  it("an unsubscribe token for the same id NEVER verifies as a restore token", () => {
    const unsub = makeUnsubToken(42, SECRET);
    expect(verifyRestoreToken(42, FUTURE, unsub, SECRET, NOW)).toBe(false);
  });

  it("restoreUrl embeds a TTL_DAYS expiry and verifies end-to-end", () => {
    const url = restoreUrl("https://citypulsemn.com", 7, SECRET, NOW);
    const u = new URL(url);
    expect(u.pathname).toBe("/saved/restore");
    const id = u.searchParams.get("id")!;
    const exp = Number(u.searchParams.get("exp"));
    const t = u.searchParams.get("t")!;
    expect(id).toBe("7");
    expect(exp).toBe(Math.floor(NOW.getTime() / 1000) + RESTORE_TTL_DAYS * 86_400);
    expect(verifyRestoreToken(id, exp, t, SECRET, NOW)).toBe(true);
    // …and it dies after the window:
    const later = new Date(NOW.getTime() + (RESTORE_TTL_DAYS * 86_400 + 60) * 1000);
    expect(verifyRestoreToken(id, exp, t, SECRET, later)).toBe(false);
  });
});

describe("restore email", () => {
  it("carries the link in html AND text, states the TTL and the no-subscribe promise", () => {
    const url = "https://citypulsemn.com/saved/restore?id=7&exp=1&t=x";
    const { subject, html, text } = renderRestoreEmail(url);
    expect(subject).toContain("saved events");
    expect(html).toContain(url);
    expect(text).toContain(url);
    expect(html).toContain(`${RESTORE_TTL_DAYS} days`);
    expect(html).toContain("doesn't sign you up");
    expect(text).toContain("doesn't sign you up");
  });
});
