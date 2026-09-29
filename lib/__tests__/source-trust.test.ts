import { describe, it, expect } from "vitest";
import {
  isAggregatorSource,
  statusForNewEvent,
  heldBackReason,
  AGGREGATOR_HOSTS,
  isResaleSource,
} from "../source-trust";

describe("isAggregatorSource", () => {
  it("catches the two URLs that actually produced fabrications", () => {
    // Westwood Hills, 9 Sep 2026 — the 2025 event re-dated to 2026.
    expect(
      isAggregatorSource(
        "https://bringmethenews.com/minnesota-lifestyle/the-twin-cities-best-halloween-events-for-the-whole-family",
      ),
    ).toBe(true);
    expect(
      isAggregatorSource("https://www.yahoo.com/news/articles/roundup-halloween-events-twin-cities-100500047.html"),
    ).toBe(true);
  });

  it("leaves an organizer's own page alone", () => {
    // These legitimately back many events each and must keep auto-publishing.
    for (const url of [
      "https://mnzoo.org/special-events/",
      "https://www.guthrietheater.org/seasons/2026-2027-season/",
      "https://renaissancefest.com/",
      "https://www.threeriversparks.org/programs",
      "https://www.stlouisparkmn.gov/calendar",
      "https://first-avenue.com/show/example/",
    ]) {
      expect(isAggregatorSource(url), url).toBe(false);
    }
  });

  it("matches subdomains but not suffix collisions", () => {
    expect(isAggregatorSource("https://www.mspmag.com/x")).toBe(true);
    expect(isAggregatorSource("https://amp.patch.com/x")).toBe(true);
    // "notyahoo.com" is a different company; endsWith without the dot would
    // have flagged it.
    expect(isAggregatorSource("https://notyahoo.com/x")).toBe(false);
    expect(isAggregatorSource("https://yahoo.com.example.org/x")).toBe(false);
  });

  it("treats junk input as not-an-aggregator rather than throwing", () => {
    for (const bad of ["", "not a url", "javascript:alert(1)", "   "]) {
      expect(() => isAggregatorSource(bad)).not.toThrow();
      expect(isAggregatorSource(bad)).toBe(false);
    }
  });

  it("the host list has no duplicates and no stray scheme/path", () => {
    expect(new Set(AGGREGATOR_HOSTS).size).toBe(AGGREGATOR_HOSTS.length);
    for (const h of AGGREGATOR_HOSTS) {
      expect(h, h).not.toMatch(/https?:|\/|^www\./);
      expect(h, h).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });
});

describe("statusForNewEvent — the gate only ever holds back", () => {
  it("holds a roundup-sourced event as draft", () => {
    expect(statusForNewEvent("https://bringmethenews.com/x/best-halloween-events")).toBe("draft");
  });

  it("publishes an organizer-sourced event", () => {
    expect(statusForNewEvent("https://mnzoo.org/special-events/")).toBe("published");
  });

  it("publishes when there is no source at all", () => {
    // A missing source is a different problem (and other guards cover it).
    // This gate must not start hiding events for a reason it isn't about.
    expect(statusForNewEvent("")).toBe("published");
  });

  it("never returns anything but published or draft", () => {
    for (const u of ["", "https://mspmag.com/a", "https://example.org", "garbage"]) {
      expect(["published", "draft"]).toContain(statusForNewEvent(u));
    }
  });
});

describe("heldBackReason", () => {
  it("names the host so the ops digest can say why", () => {
    const r = heldBackReason("https://bringmethenews.com/x/best-halloween-events");
    expect(r).toContain("bringmethenews.com");
    expect(r).toContain("verified");
  });

  it("is null when nothing was held back", () => {
    expect(heldBackReason("https://mnzoo.org/special-events/")).toBeNull();
  });
});

describe("isResaleSource — lookalikes, not box offices", () => {
  it("catches the domains that were live on 29 Sep", () => {
    for (const u of [
      "https://first-avenue.minneapolis-tickets.com/",
      "https://dakota-jazz-club.minneapolistickets.org/",
      "https://myth-live.ticketsminneapolis.org/",
      "https://www.eventticketscenter.com/ames-center-burnsville-minneapolis-tickets/",
    ]) {
      expect(isResaleSource(u), u).toBe(true);
    }
  });

  it("leaves the real box offices alone", () => {
    // These genuinely sell for many rooms, and their venue pages happen to
    // contain the word "minneapolis-tickets" in the PATH — which is why this
    // matches on host suffix and not on the URL string.
    for (const u of [
      "https://www.axs.com/venues/130256/uptown-theater-minneapolis-minneapolis-tickets",
      "https://www.ticketmaster.com/target-center-minneapolis-tickets-minneapolis-mn/venue/54321",
      "https://first-avenue.com/event/2026-10-muna/",
      "https://www.thecedar.org/events/iamjoy",
    ]) {
      expect(isResaleSource(u), u).toBe(false);
    }
  });

  it("is false for junk rather than throwing", () => {
    expect(isResaleSource("")).toBe(false);
    expect(isResaleSource("not a url")).toBe(false);
  });
});
