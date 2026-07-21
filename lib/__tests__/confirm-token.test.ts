import { describe, it, expect } from "vitest";
import {
  makeConfirmToken,
  verifyConfirmToken,
  confirmUrl,
  CONFIRM_TTL_DAYS,
} from "../confirm-token";
import { makeUnsubToken } from "../unsubscribe-token";
import { makeRestoreToken } from "../restore-token";
import { renderConfirmEmail } from "../confirm-send";

const SECRET = "test-secret";
const NOW = new Date("2026-07-21T12:00:00Z");
const FUTURE = Math.floor(NOW.getTime() / 1000) + 3600;

describe("confirm token (F2.3) — the security surface", () => {
  it("round-trips a valid, unexpired token", () => {
    const t = makeConfirmToken(42, FUTURE, SECRET);
    expect(verifyConfirmToken(42, FUTURE, t, SECRET, NOW)).toBe(true);
  });

  it("EXPIRES one second past exp", () => {
    const t = makeConfirmToken(42, FUTURE, SECRET);
    expect(verifyConfirmToken(42, FUTURE, t, SECRET, new Date((FUTURE + 1) * 1000))).toBe(false);
  });

  it("rejects tampered id, exp, or token", () => {
    const t = makeConfirmToken(42, FUTURE, SECRET);
    expect(verifyConfirmToken(43, FUTURE, t, SECRET, NOW)).toBe(false);
    expect(verifyConfirmToken(42, FUTURE + 9999, t, SECRET, NOW)).toBe(false);
    expect(verifyConfirmToken(42, FUTURE, t.slice(0, -2) + "xx", SECRET, NOW)).toBe(false);
    expect(verifyConfirmToken(42, NaN, t, SECRET, NOW)).toBe(false);
    expect(verifyConfirmToken(42, FUTURE, "", SECRET, NOW)).toBe(false);
  });

  /**
   * CROSS-PURPOSE REPLAY: an unsubscribe token sits in every email footer
   * forever; a restore token is a bearer credential. Neither may ever be
   * replayed as a CONFIRM token (which promotes pending → subscribed), even
   * though all three families share the one secret.
   */
  it("neither an unsubscribe NOR a restore token verifies as a confirm token", () => {
    expect(verifyConfirmToken(42, FUTURE, makeUnsubToken(42, SECRET), SECRET, NOW)).toBe(false);
    expect(verifyConfirmToken(42, FUTURE, makeRestoreToken(42, FUTURE, SECRET), SECRET, NOW)).toBe(false);
  });

  it("confirmUrl embeds the TTL expiry and verifies end-to-end, then dies", () => {
    const url = confirmUrl("https://www.citypulsemn.com", 7, SECRET, NOW);
    const u = new URL(url);
    expect(u.pathname).toBe("/subscribe/confirm");
    const id = u.searchParams.get("id")!;
    const exp = Number(u.searchParams.get("exp"));
    const t = u.searchParams.get("t")!;
    expect(id).toBe("7");
    expect(exp).toBe(Math.floor(NOW.getTime() / 1000) + CONFIRM_TTL_DAYS * 86_400);
    expect(verifyConfirmToken(id, exp, t, SECRET, NOW)).toBe(true);
    const later = new Date(NOW.getTime() + (CONFIRM_TTL_DAYS * 86_400 + 60) * 1000);
    expect(verifyConfirmToken(id, exp, t, SECRET, later)).toBe(false);
  });
});

describe("confirm email (F2.3)", () => {
  it("carries the link in html AND text, states the TTL and the stay-unsubscribed promise", () => {
    const url = "https://www.citypulsemn.com/subscribe/confirm?id=7&exp=1&t=x";
    const { subject, html, text } = renderConfirmEmail(url);
    expect(subject.toLowerCase()).toContain("confirm");
    expect(html).toContain(url);
    expect(text).toContain(url);
    expect(html).toContain(`${CONFIRM_TTL_DAYS} days`);
    expect(html).toContain("stay unsubscribed");
    expect(text).toContain("stay unsubscribed");
  });
});
