import { describe, it, expect } from "vitest";
import { eventDotColors } from "../calendar-dots";
import { categoryColor } from "../categories";
import type { CategoryKey, EventRecord } from "../types";

function ev(category: CategoryKey): EventRecord {
  return {
    id: Math.random().toString(36).slice(2),
    title: "E",
    category,
    venue: "V",
    address: "",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-07-15T19:00",
    end: "2026-07-15T21:00",
    price: "Free",
    priceTier: "Free",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
  };
}

describe("eventDotColors (calendar day dots)", () => {
  it("returns one color per event in category color", () => {
    const colors = eventDotColors([ev("music"), ev("food")]);
    expect(colors).toEqual([categoryColor("music"), categoryColor("food")]);
  });

  it("caps at 4 dots for busy days", () => {
    const busy = Array.from({ length: 7 }, () => ev("music"));
    expect(eventDotColors(busy)).toHaveLength(4);
  });

  it("respects a custom cap", () => {
    const busy = Array.from({ length: 5 }, () => ev("arts"));
    expect(eventDotColors(busy, 2)).toHaveLength(2);
  });

  it("returns nothing for an empty day", () => {
    expect(eventDotColors([])).toEqual([]);
  });
});
