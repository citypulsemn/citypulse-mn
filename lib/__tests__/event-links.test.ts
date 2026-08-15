import { describe, it, expect } from "vitest";
import { eventLinks, isAggregatorUrl, hostMatchesVenue } from "../event-links";

describe("isAggregatorUrl", () => {
  it("flags known ticketing / resale / aggregator hosts (and subdomains)", () => {
    expect(isAggregatorUrl("https://www.ticketmaster.com/event/123")).toBe(true);
    expect(isAggregatorUrl("https://concerts.livenation.com/x")).toBe(true); // subdomain
    expect(isAggregatorUrl("https://www.eventbrite.com/e/abc-456")).toBe(true);
    expect(isAggregatorUrl("https://stubhub.com/resale")).toBe(true);
  });

  it("does not flag venue / official pages, or a domain merely containing a name", () => {
    expect(isAggregatorUrl("https://first-avenue.com/show/abc")).toBe(false);
    expect(isAggregatorUrl("https://notticketmaster.com/x")).toBe(false);
    expect(isAggregatorUrl("")).toBe(false);
    expect(isAggregatorUrl("not a url")).toBe(false);
  });
});

describe("hostMatchesVenue", () => {
  it("matches a host that contains a distinctive venue word", () => {
    expect(hostMatchesVenue("allianzfield.com", "Allianz Field")).toBe(true); // via "allianz"
    expect(hostMatchesVenue("fillmoreminneapolis.com", "The Fillmore Minneapolis")).toBe(true);
    expect(hostMatchesVenue("bellmuseum.umn.edu", "Bell Museum")).toBe(true);
    expect(hostMatchesVenue("grandcasinoarena.com", "Grand Casino Arena")).toBe(true); // via "grand"/"casino"
  });

  it("does not match unrelated content/news hosts", () => {
    expect(hostMatchesVenue("aol.com", "Mystic Lake Amphitheater")).toBe(false);
    expect(hostMatchesVenue("twincitiesfamily.com", "Surly Brewing Festival Field")).toBe(false);
    expect(hostMatchesVenue("exploreminnesota.com", "Target Center")).toBe(false);
  });

  it("does not match on generic words alone", () => {
    // "field" is generic — must not match a random host that contains it.
    expect(hostMatchesVenue("fieldnotes.com", "Allianz Field")).toBe(false);
    expect(hostMatchesVenue("theclubhouse.com", "Turf Club")).toBe(false); // "club" is generic; "turf" not in host
  });

  it("is false for empty inputs", () => {
    expect(hostMatchesVenue(null, "Allianz Field")).toBe(false);
    expect(hostMatchesVenue("allianzfield.com", "")).toBe(false);
  });
});

describe("eventLinks — official (venue) site first (U4)", () => {
  it("leads with the venue's official page and keeps tickets second when ticket is a third party", () => {
    const out = eventLinks({
      ticketUrl: "https://www.ticketmaster.com/event/123",
      sourceUrl: "https://first-avenue.com/show/abc",
      venue: "First Avenue",
    });
    expect(out.primary).toEqual({ url: "https://first-avenue.com/show/abc", label: "Official site", kind: "official" });
    expect(out.secondary).toEqual({ url: "https://www.ticketmaster.com/event/123", label: "Tickets", kind: "tickets" });
  });

  it("does NOT promote a source that doesn't match the venue (a news/listing site)", () => {
    const out = eventLinks({
      ticketUrl: "https://www.ticketmaster.com/event/123",
      sourceUrl: "https://www.aol.com/news/some-article",
      venue: "Mystic Lake Amphitheater",
    });
    expect(out.primary?.kind).toBe("tickets");
    expect(out.primary?.url).toBe("https://www.ticketmaster.com/event/123");
    expect(out.secondary).toBeNull();
  });

  it("keeps a single ticket CTA when the ticket link is already on the venue site", () => {
    const out = eventLinks({
      ticketUrl: "https://first-avenue.com/tickets/abc",
      sourceUrl: "https://first-avenue.com/show/abc",
      venue: "First Avenue",
    });
    expect(out.primary).toEqual({ url: "https://first-avenue.com/tickets/abc", label: "Tickets & Info", kind: "tickets" });
    expect(out.secondary).toBeNull();
  });

  it("keeps a lone aggregator ticket as the single CTA when there is no venue source", () => {
    const out = eventLinks({ ticketUrl: "https://www.eventbrite.com/e/abc", sourceUrl: "", venue: "Some Hall" });
    expect(out.primary).toEqual({ url: "https://www.eventbrite.com/e/abc", label: "Tickets & Info", kind: "tickets" });
    expect(out.secondary).toBeNull();
  });

  it("surfaces the venue's official page when there is no ticket link (beats 'coming soon')", () => {
    const out = eventLinks({ ticketUrl: "", sourceUrl: "https://walkerart.org/calendar/x", venue: "Walker Art Center" });
    expect(out.primary).toEqual({ url: "https://walkerart.org/calendar/x", label: "Official site", kind: "official" });
    expect(out.secondary).toBeNull();
  });

  it("safely does NOT promote a venue whose name is only geography / short words (conservative miss)", () => {
    // "Minnesota Zoo": "minnesota" is stoplisted geography, "zoo" is too short — no
    // distinctive token, so we don't claim its source is official (falls back to ticket).
    const out = eventLinks({ ticketUrl: "https://www.ticketmaster.com/x", sourceUrl: "https://mnzoo.org/e", venue: "Minnesota Zoo" });
    expect(out.primary?.kind).toBe("tickets");
    expect(out.secondary).toBeNull();
  });

  it("does NOT surface a non-venue source when there is no ticket link", () => {
    const out = eventLinks({ ticketUrl: "", sourceUrl: "https://www.exploreminnesota.com/x", venue: "Target Field" });
    expect(out.primary).toBeNull();
  });

  it("returns null primary when there is nothing to link to", () => {
    expect(eventLinks({ ticketUrl: "", sourceUrl: "", venue: "X" }).primary).toBeNull();
    expect(eventLinks({}).primary).toBeNull();
  });
});
