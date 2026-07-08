import { describe, it, expect } from "vitest";
import {
  eventJsonLd,
  dayItemListJsonLd,
  chicagoOffset,
  toIsoWithOffset,
  lowestPrice,
} from "../seo/event-jsonld";
import type { EventRecord } from "../types";

const BASE = "https://citypulsemn.com";

function ev(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "abc",
    title: "Trampled by Turtles",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9785,
    lng: -93.2762,
    start: "2026-07-15T20:00",
    end: "2026-07-15T23:00",
    price: "$35",
    priceTier: "$$",
    ticketUrl: "https://tickets.example/x",
    description: "A hometown show.",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

describe("chicagoOffset / toIsoWithOffset", () => {
  it("summer dates are CDT (-05:00)", () => {
    expect(chicagoOffset("2026-07-15")).toBe("-05:00");
    expect(toIsoWithOffset("2026-07-15T20:00")).toBe("2026-07-15T20:00:00-05:00");
  });
  it("winter dates are CST (-06:00)", () => {
    expect(chicagoOffset("2026-01-15")).toBe("-06:00");
    expect(toIsoWithOffset("2026-01-15T20:00")).toBe("2026-01-15T20:00:00-06:00");
  });
});

describe("lowestPrice", () => {
  it("parses a single price", () => expect(lowestPrice("$35")).toBe(35));
  it("takes the low end of a range", () => expect(lowestPrice("$18-$120")).toBe(18));
  it("returns null when there's no number", () => expect(lowestPrice("See listing")).toBeNull());
});

describe("eventJsonLd", () => {
  it("emits a valid-shaped Event with location, geo, offers, and TZ start", () => {
    const d = eventJsonLd(ev(), { baseUrl: BASE });
    expect(d["@type"]).toBe("Event");
    expect(d.name).toBe("Trampled by Turtles");
    expect(d.startDate).toBe("2026-07-15T20:00:00-05:00");
    expect(d.endDate).toBe("2026-07-15T23:00:00-05:00");
    expect(d.url).toBe(`${BASE}/event/abc`);
    expect(d.eventStatus).toBe("https://schema.org/EventScheduled");
    const loc = d.location as any;
    expect(loc.name).toBe("First Avenue");
    expect(loc.geo.latitude).toBe(44.9785);
    const offers = d.offers as any;
    expect(offers.price).toBe("35");
    expect(offers.priceCurrency).toBe("USD");
  });

  it("free events price at 0", () => {
    const d = eventJsonLd(ev({ price: "Free", priceTier: "Free" }), { baseUrl: BASE });
    expect((d.offers as any).price).toBe("0");
  });

  it("ranged prices offer the low end", () => {
    const d = eventJsonLd(ev({ price: "$18-$120", priceTier: "$$" }), { baseUrl: BASE });
    expect((d.offers as any).price).toBe("18");
  });

  it("unknown price omits offers (no invalid empty price)", () => {
    const d = eventJsonLd(ev({ price: "See listing", priceTier: "$$" }), { baseUrl: BASE });
    expect(d.offers).toBeUndefined();
  });

  it("cancelled maps to EventCancelled", () => {
    const d = eventJsonLd(ev({ status: "cancelled" }), { baseUrl: BASE });
    expect(d.eventStatus).toBe("https://schema.org/EventCancelled");
  });

  it("no end time omits endDate", () => {
    const d = eventJsonLd(ev({ end: "" }), { baseUrl: BASE });
    expect(d.endDate).toBeUndefined();
  });

  it("suburb address carries locality + region + country", () => {
    const d = eventJsonLd(ev({ city: "Plymouth", address: "3400 Plymouth Blvd" }), { baseUrl: BASE });
    const addr = (d.location as any).address;
    expect(addr.addressLocality).toBe("Plymouth");
    expect(addr.addressRegion).toBe("MN");
    expect(addr.addressCountry).toBe("US");
  });

  it("ungeocoded (0,0) omits geo", () => {
    const d = eventJsonLd(ev({ lat: 0, lng: 0 }), { baseUrl: BASE });
    expect((d.location as any).geo).toBeUndefined();
  });

  it("includes image when provided", () => {
    const d = eventJsonLd(ev(), { baseUrl: BASE, imageUrl: `${BASE}/event/abc/opengraph-image` });
    expect(d.image).toEqual([`${BASE}/event/abc/opengraph-image`]);
  });
});

describe("dayItemListJsonLd", () => {
  it("lists events as positioned ListItems with URLs", () => {
    const d = dayItemListJsonLd([ev({ id: "1" }), ev({ id: "2" })], { baseUrl: BASE });
    expect(d["@type"]).toBe("ItemList");
    const items = d.itemListElement as any[];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ position: 1, url: `${BASE}/event/1` });
    expect(items[1].position).toBe(2);
  });
});
