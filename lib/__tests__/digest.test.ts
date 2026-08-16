import { describe, it, expect } from "vitest";
import {
  digestEvents,
  renderDigestEmail,
  digestWeekLabel,
  sponsorSlotHtml,
  sponsorSlotText,
  DIGEST_SPONSOR,
  selectMostSaved,
  MOST_SAVED_MIN,
  placeOfWeekHtml,
  placeOfWeekText,
  mostSavedHtml,
  mostSavedText,
} from "../digest";
import { makeUnsubToken, verifyUnsubToken, unsubscribeUrl } from "../unsubscribe-token";
import type { Place } from "../places";
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
  it("carries a forward-to-a-friend link to /this-week (G1.1 referral loop)", () => {
    expect(out.html).toContain("https://citypulsemn.com/this-week?utm_source=email&utm_medium=forward");
    expect(out.text).toContain("https://citypulsemn.com/this-week");
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

describe("digest depth — most saved this week (v6 1.3)", () => {
  const a = ev({ id: "a", title: "Fringe Festival" });
  const b = ev({ id: "b", title: "Art Fair" });
  const c = ev({ id: "c", title: "Restaurant Week" });
  const byId = new Map<string, EventRecord>([a, b, c].map((e) => [e.id, e]));

  it("keeps only events at or above the privacy/noise floor, highest first", () => {
    const picked = selectMostSaved(
      [
        { id: "a", saves: MOST_SAVED_MIN + 4 },
        { id: "b", saves: MOST_SAVED_MIN }, // exactly the floor — kept
        { id: "c", saves: MOST_SAVED_MIN - 1 }, // below — dropped
      ],
      byId,
    );
    expect(picked.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("stays dark when saves are thin (nothing meets the floor)", () => {
    const picked = selectMostSaved([{ id: "a", saves: 1 }, { id: "b", saves: 2 }], byId);
    expect(picked).toEqual([]);
    expect(mostSavedHtml(picked, "https://citypulsemn.com")).toBe("");
    expect(mostSavedText(picked, "https://citypulsemn.com")).toBe("");
  });

  it("drops a saved event that is no longer in the published set (never featured stale)", () => {
    const picked = selectMostSaved([{ id: "gone", saves: 99 }, { id: "a", saves: 5 }], byId);
    expect(picked.map((e) => e.id)).toEqual(["a"]);
  });

  it("caps the list at three", () => {
    const many = Array.from({ length: 6 }, (_, i) => ev({ id: `m${i}` }));
    const bigId = new Map(many.map((e) => [e.id, e]));
    const picked = selectMostSaved(
      many.map((e, i) => ({ id: e.id, saves: MOST_SAVED_MIN + 10 - i })),
      bigId,
    );
    expect(picked.length).toBe(3);
  });

  it("renders a labeled section with the event titles when present", () => {
    const picked = selectMostSaved([{ id: "a", saves: 5 }], byId);
    const html = mostSavedHtml(picked, "https://citypulsemn.com");
    expect(html).toContain("Most saved this week");
    expect(html).toContain("Fringe Festival");
    expect(mostSavedText(picked, "https://citypulsemn.com")).toContain("MOST SAVED THIS WEEK");
  });
});

describe("digest depth — place of the week (v6 1.3)", () => {
  const place: Place = {
    slug: "wirth-lake-beach",
    name: "Wirth Lake Beach",
    kind: "beach",
    lat: 44.98,
    lng: -93.32,
    address: "3200 Glenwood Ave",
    city: "Minneapolis",
    neighborhood: null,
    season: { type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" },
    cost: "free",
    tags: [],
    intro: "The metro's only downtown-adjacent swimming beach, with a guarded sand shore.",
    sourceUrl: "https://minneapolisparks.org/",
    verifiedAt: "2026-08-07",
    venueSlug: null,
  };

  it("renders nothing when there is no place (honest emptiness)", () => {
    expect(placeOfWeekHtml(null, "https://citypulsemn.com")).toBe("");
    expect(placeOfWeekText(null, "https://citypulsemn.com")).toBe("");
  });

  it("renders the name, kind, intro, and a UTM'd deep link into the kind page", () => {
    const html = placeOfWeekHtml(place, "https://citypulsemn.com");
    expect(html).toContain("Place of the week");
    expect(html).toContain("Wirth Lake Beach");
    expect(html).toContain("Beach · Minneapolis");
    expect(html).toContain("guarded sand shore");
    expect(html).toContain("/places/beach?utm_source=email&utm_medium=digest#wirth-lake-beach");
    const text = placeOfWeekText(place, "https://citypulsemn.com");
    expect(text).toContain("PLACE OF THE WEEK");
    expect(text).toContain("Wirth Lake Beach — Beach · Minneapolis");
  });

  it("escapes HTML in the place name and intro", () => {
    const risky = placeOfWeekHtml({ ...place, name: "A & <B>", intro: "<script>x</script>" }, "#");
    expect(risky).toContain("A &amp; &lt;B&gt;");
    expect(risky).not.toContain("<script>");
  });
});

describe("renderDigestEmail — 1.3 sections integration", () => {
  const events = [ev({ id: "a", title: "Trampled by Turtles" })];
  const base = { events, weekLabel: "July 13 – 19", unsubscribeUrl: "#", siteUrl: "https://citypulsemn.com" };
  const place: Place = {
    slug: "como-pool", name: "Como Pool", kind: "pool", lat: 44.98, lng: -93.15,
    address: "1151 Como Ave", city: "St. Paul", neighborhood: null,
    season: { type: "seasonal", openMonth: 6, closeMonth: 8, label: "June–August" },
    cost: "paid", tags: [], intro: "A zero-depth entry and a 130-foot waterslide by the lake.",
    sourceUrl: "https://stpaul.gov/", verifiedAt: "2026-08-07", venueSlug: null,
  };

  it("omits both sections by default (no options passed)", () => {
    const out = renderDigestEmail(base);
    expect(out.html).not.toContain("Place of the week");
    expect(out.html).not.toContain("Most saved this week");
    expect(out.text).not.toContain("PLACE OF THE WEEK");
  });

  it("includes place-of-the-week when provided, in html and text", () => {
    const out = renderDigestEmail({ ...base, placeOfWeek: place });
    expect(out.html).toContain("Place of the week");
    expect(out.html).toContain("Como Pool");
    expect(out.text).toContain("Como Pool");
  });

  it("includes most-saved when provided", () => {
    const out = renderDigestEmail({ ...base, mostSaved: [ev({ id: "z", title: "Kielbasa Festival" })] });
    expect(out.html).toContain("Most saved this week");
    expect(out.html).toContain("Kielbasa Festival");
  });
});

describe("newsletter sponsor slot (R2.1)", () => {
  const events = [ev({ id: "a", title: "Trampled by Turtles" })];
  const base = {
    events,
    weekLabel: "July 13 – 19",
    unsubscribeUrl: "#",
    siteUrl: "https://citypulsemn.com",
  };

  it("ships dark by default — no sponsor configured, no band rendered", () => {
    expect(DIGEST_SPONSOR).toBeNull();
    const out = renderDigestEmail(base); // no sponsor passed ⇒ module default (null)
    expect(out.html).not.toContain("Presented by");
    expect(out.text).not.toContain("PRESENTED BY");
  });

  it("null passed explicitly also renders nothing (honest emptiness, no placeholder)", () => {
    expect(sponsorSlotHtml(null)).toBe("");
    expect(sponsorSlotText(null)).toBe("");
    const out = renderDigestEmail({ ...base, sponsor: null });
    expect(out.html).not.toContain("Presented by");
  });

  it("renders a clearly-labeled band with name, tagline, and a UTM'd link", () => {
    const out = renderDigestEmail({
      ...base,
      sponsor: { name: "Surly Brewing", url: "https://surlybrewing.com", tagline: "Beer hall in Prospect Park." },
    });
    expect(out.html).toContain("Presented by"); // the honest label
    expect(out.html).toContain("Surly Brewing");
    expect(out.html).toContain("Beer hall in Prospect Park.");
    expect(out.html).toContain("https://surlybrewing.com?utm_source=email&utm_medium=digest&utm_campaign=sponsor");
    expect(out.text).toContain("PRESENTED BY: Surly Brewing");
    expect(out.text).toContain("Beer hall in Prospect Park.");
  });

  it("name-only sponsor: no link, no tagline line", () => {
    const html = sponsorSlotHtml({ name: "A Local Shop" });
    expect(html).toContain("A Local Shop");
    expect(html).not.toContain("<a href");
    const text = sponsorSlotText({ name: "A Local Shop" });
    expect(text).toBe("PRESENTED BY: A Local Shop");
  });

  it("appends UTM correctly when the sponsor url already has a query", () => {
    const html = sponsorSlotHtml({ name: "X", url: "https://x.com/?ref=cp" });
    expect(html).toContain("https://x.com/?ref=cp&utm_source=email&utm_medium=digest&utm_campaign=sponsor");
  });

  it("escapes HTML in the sponsor name and tagline", () => {
    const html = sponsorSlotHtml({ name: "Bar & <Grill>", tagline: "<b>eat</b>" });
    expect(html).toContain("Bar &amp; &lt;Grill&gt;");
    expect(html).not.toContain("<Grill>");
    expect(html).not.toContain("<b>eat</b>");
  });
});
