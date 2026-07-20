import { describe, it, expect } from "vitest";
import {
  chiWallClock,
  chiNow,
  chiDayKey,
  chiTodayKey,
  isPastWall,
  chicagoOffset,
  wallToInstant,
} from "../clock";

// 2026 DST transitions in Chicago: spring forward Sun Mar 8 (2:00 AM CST →
// 3:00 AM CDT), fall back Sun Nov 1 (2:00 AM CDT → 1:00 AM CST).

describe("chiWallClock / chiDayKey — instant → Chicago wall frame", () => {
  it("CDT (summer, -5): 23:00Z is 6 PM wall", () => {
    expect(chiWallClock(new Date("2026-07-20T23:00:00Z"))).toBe("2026-07-20T18:00");
  });
  it("CST (winter, -6): 18:30Z is 12:30 PM wall", () => {
    expect(chiWallClock(new Date("2027-01-10T18:30:00Z"))).toBe("2027-01-10T12:30");
  });
  it("day-key boundary: 4:59Z is still yesterday in Chicago; 5:00Z is midnight", () => {
    expect(chiDayKey(new Date("2026-07-21T04:59:00Z"))).toBe("2026-07-20"); // 11:59 PM CDT
    expect(chiDayKey(new Date("2026-07-21T05:00:00Z"))).toBe("2026-07-21"); // 12:00 AM CDT
  });
  it("winter boundary shifts an hour: 5:59Z is still yesterday, 6:00Z is midnight", () => {
    expect(chiDayKey(new Date("2027-01-11T05:59:00Z"))).toBe("2027-01-10"); // 11:59 PM CST
    expect(chiDayKey(new Date("2027-01-11T06:00:00Z"))).toBe("2027-01-11");
  });
  it("chiNow / chiTodayKey agree with each other's frame", () => {
    expect(chiNow().slice(0, 10)).toBe(chiTodayKey());
    expect(chiNow()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("isPastWall — wall-to-wall only (rule 10)", () => {
  it("plain string ordering on the shared format", () => {
    expect(isPastWall("2026-07-20T18:00", "2026-07-20T18:01")).toBe(true);
    expect(isPastWall("2026-07-20T18:00", "2026-07-20T18:00")).toBe(false);
    expect(isPastWall("2026-07-20T19:00", "2026-07-20T18:59")).toBe(false);
  });
});

describe("chicagoOffset — CST/CDT incl. the DST-transition hours the noon probe missed", () => {
  it("ordinary days, both notations", () => {
    expect(chicagoOffset("2026-07-15")).toBe("-05:00");
    expect(chicagoOffset("2026-07-15T20:00")).toBe("-05:00");
    expect(chicagoOffset("2026-01-15")).toBe("-06:00");
    expect(chicagoOffset("2026-01-15T20:00")).toBe("-06:00");
  });
  it("spring-forward day (Mar 8): 1:30 AM is still CST while noon is CDT", () => {
    expect(chicagoOffset("2026-03-08T01:30")).toBe("-06:00"); // the old noon probe said -05:00
    expect(chicagoOffset("2026-03-08T12:00")).toBe("-05:00");
  });
  it("fall-back day (Nov 1): 12:30 AM is still CDT while noon is CST", () => {
    expect(chicagoOffset("2026-11-01T00:30")).toBe("-05:00"); // the old noon probe said -06:00
    expect(chicagoOffset("2026-11-01T12:00")).toBe("-06:00");
  });
  it("the ambiguous fall-back hour resolves to its first (CDT) occurrence, deterministically", () => {
    expect(chicagoOffset("2026-11-01T01:30")).toBe("-05:00");
  });
});

describe("wallToInstant — serialization boundary, round-trips through the wall frame", () => {
  it("round-trips ordinary CDT and CST walls", () => {
    for (const wall of ["2026-07-20T19:00", "2026-01-15T07:05", "2026-11-01T00:30", "2026-03-08T01:30"]) {
      expect(chiWallClock(wallToInstant(wall))).toBe(wall);
    }
  });
  it("denotes the correct absolute instants", () => {
    expect(wallToInstant("2026-07-20T19:00").toISOString()).toBe("2026-07-21T00:00:00.000Z");
    expect(wallToInstant("2026-01-15T19:00").toISOString()).toBe("2026-01-16T01:00:00.000Z");
  });
  it("date-only wall means Chicago midnight", () => {
    expect(wallToInstant("2026-07-20").toISOString()).toBe("2026-07-20T05:00:00.000Z");
  });
});
