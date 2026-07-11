import { describe, it, expect } from "vitest";
import { digestEvents, renderDigestEmail, digestWeekLabel } from "../digest";
import { makeUnsubToken, verifyUnsubToken, unsubscribeUrl } from "../unsubscribe-token";
import type { EventRecord } from "../types";

const NOW = new Date("2026-07-13T09:00:00-05:00"); // Monday
const SECRET = "test-secret-123";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Event",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T20:00",
    end: "",
    price: "$25",
    priceTier: "$$",
    ticketUrl: "https://t.co/x",
    description: "A great show with plenty of detail in the description field here.",
    image: "https://img/x.jpg",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("unsubscribe token", () => {
  it("is deterministic for the same id + secret", () => {
    expect(makeUnsubToken(42, SECRET)).toBe(makeUnsubToken("42", SECRET));
  });
  it("verifies a correct token", () => {
    const t = makeUnsubToken(42, SECRET);
    expect(verifyUnsubToken(42, t, SECRET)).toBe(true);
  });
  it("rejects wrong id, token, or secret", () => {
    const t = makeUnsubToken(42, SECRET);
    expect(verifyUnsubToken(43, t, SECRET)).toBe(false);
    expect(verifyUnsubToken(42, t + "x", SECRET)).toBe(false);
    expect(verifyUnsubToken(42, t, "other")).toBe(false);
    expect(verifyUnsubToken(42, "", SECRET)).toBe(false);
  });
  it("builds an unsubscribe URL with id and token", () => {
    const url = unsubscribeUrl("https://citypulsemn.com", 7, SECRET);
    expect(url).toContain("https://citypulsemn.com/unsubscribe?id=7&t=");
  });
});

describe("digestWeekLabel", () => {
  it("formats a same-month range", () => {
    expect(digestWeekLabel(new Date("2026-07-13T12:00:00Z"))).toBe("July 13 – 19");
  });
});

describe("digestEvents", () => {
  const list = [
    ev({ id: "music1", category: "music", start: "2026-07-15T20:00" }),
    ev({ id: "fam1", category: "family", start: "2026-07-16T10:00" }),
    ev({ id: "weird1", category: "weird", start: "2026-07-17T19:00" }),
    ev({ id: "far", category: "music", start: "2026-09-01T20:00" }), // outside 7d
    ev({ id: "draft", category: "music", start: "2026-07-15T21:00", status: "draft" }),
  ];

  it("selects published events in the week, incl. family + unique", () => {
    const picks = digestEvents(list, NOW);
    const ids = picks.map((e) => e.id);
    expect(ids).toContain("fam1");
    expect(ids).toContain("weird1");
    expect(ids).not.toContain("far");
    expect(ids).not.toContain("draft");
  });
  it("caps at 8 and sorts chronologically", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      ev({ id: `e${i}`, start: `2026-07-1${(i % 5) + 4}T1${i % 9}:00` }),
    );
    const picks = digestEvents(many, NOW);
    expect(picks.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < picks.length; i++) {
      expect(new Date(picks[i].start).getTime()).toBeGreaterThanOrEqual(
        new Date(picks[i - 1].start).getTime(),
      );
    }
  });
});

describe("renderDigestEmail", () => {
  const events = [
    ev({ id: "a", title: "Trampled by Turtles", start: "2026-07-15T20:00" }),
    ev({ id: "b", title: "Farmers Market", category: "food", start: "2026-07-18T09:00" }),
  ];
  const out = renderDigestEmail({
    events,
    weekLabel: "July 13 – 19",
    unsubscribeUrl: "https://citypulsemn.com/unsubscribe?id=5&t=abc",
    siteUrl: "https://citypulsemn.com",
  });

  it("subject features the top event and a count", () => {
    expect(out.subject).toContain("Trampled by Turtles");
    expect(out.subject).toContain("+ 1 more");
  });
  it("html contains titles, event links with utm, and the unsubscribe link", () => {
    expect(out.html).toContain("Trampled by Turtles");
    expect(out.html).toContain("Farmers Market");
    expect(out.html).toContain("/event/a?utm_source=email");
    expect(out.html).toContain("https://citypulsemn.com/unsubscribe?id=5&t=abc");
    expect(out.html).toContain("CITY PULSE MN");
  });
  it("text version mirrors the content", () => {
    expect(out.text).toContain("Trampled by Turtles");
    expect(out.text).toContain("Unsubscribe: https://citypulsemn.com/unsubscribe?id=5&t=abc");
  });
  it("escapes HTML in titles", () => {
    const risky = renderDigestEmail({
      events: [ev({ id: "x", title: "Rock & <Roll>" })],
      weekLabel: "July 13 – 19",
      unsubscribeUrl: "#",
      siteUrl: "https://citypulsemn.com",
    });
    expect(risky.html).toContain("Rock &amp; &lt;Roll&gt;");
    expect(risky.html).not.toContain("<Roll>");
  });
  it("handles an empty set with a sensible subject", () => {
    const empty = renderDigestEmail({ events: [], weekLabel: "July 13 – 19", unsubscribeUrl: "#", siteUrl: "https://citypulsemn.com" });
    expect(empty.subject).toBe("This week in the Twin Cities");
  });
});
