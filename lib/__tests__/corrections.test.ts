import { describe, it, expect } from "vitest";
import {
  planCorrection,
  validateCorrection,
  describePlan,
  type Correction,
  type CorrectionRow,
} from "../corrections";
import { computeEventKey } from "../event-key";

// The real Jigitz row as it stood on 18 Oct 2026, down to the address spelling.
function row(overrides: Partial<CorrectionRow> = {}): CorrectionRow {
  const base: CorrectionRow = {
    id: "e1d69feb-c977-42eb-99ec-ed1937b54552",
    event_key: "af58fe8bae008b8ba8745746ed3c3b63",
    title: "Jigitz – 50 Ballerinas Tour",
    venue: "Green Room",
    city: "Minneapolis",
    address: "2923 Girard Avenue South",
    start_local: "2026-10-23T20:00",
    end_local: "2026-10-23T23:00",
    lat: 44.948965,
    lng: -93.29675,
    status: "published",
  };
  const r = { ...base, ...overrides };
  // Keep the stored key honest unless a test overrides it on purpose.
  if (!overrides.event_key) r.event_key = computeEventKey(r.title, r.venue, r.start_local);
  return r;
}

const base = (c: Partial<Correction> = {}): Correction => ({
  id: "e1d69feb-c977-42eb-99ec-ed1937b54552",
  why: "the venue's own calendar disagrees",
  ...c,
});

describe("planCorrection", () => {
  it("rewrites identity when the room changes, and carries the pin with it", () => {
    const r = row();
    const p = planCorrection(r, base({ venue: "Varsity Theater", address: "1308 4th St SE", lat: 44.98057, lng: -93.236896 }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.newKey).toBe(computeEventKey(r.title, "Varsity Theater", r.start_local));
    expect(p.newKey).not.toBe(r.event_key);
    expect(p.fields.lat).toBe(44.98057);
    expect(p.changed.some((c) => c.startsWith("venue:"))).toBe(true);
  });

  it("KEEPS identity for a time-only change, because the key uses the day", () => {
    // 16 of the 28 corrections the 17 Oct pass proposed were time-only. If these
    // rewrote the key, every one would orphan its row from the next pipeline run.
    const r = row();
    const p = planCorrection(r, base({ start: "2026-10-23T19:00" }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.newKey).toBeNull();
    expect(p.fields.start_local).toBe("2026-10-23T19:00");
  });

  it("rewrites identity when the day changes", () => {
    const r = row();
    const p = planCorrection(r, base({ start: "2027-03-14T19:30" }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.newKey).toBe(computeEventKey(r.title, r.venue, "2027-03-14T19:30"));
  });

  it("is a no-op when the row already says this", () => {
    // Re-running a correction file must not write a second audit row claiming a
    // change that already happened.
    const r = row();
    const p = planCorrection(r, base({ start: r.start_local, venue: r.venue, lat: r.lat!, lng: r.lng! }));
    expect(p.kind).toBe("nothing");
  });

  it("archives, and says nothing when already archived", () => {
    expect(planCorrection(row(), base({ archive: true })).kind).toBe("archive");
    expect(planCorrection(row({ status: "archived" }), base({ archive: true })).kind).toBe("nothing");
  });

  it("reports only the fields that actually differ", () => {
    const r = row();
    const p = planCorrection(r, base({ city: r.city, start: "2026-10-23T19:00" }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(Object.keys(p.fields)).toEqual(["start_local"]);
  });

  it("can clear an end time without clearing it by accident", () => {
    const withNull = planCorrection(row(), base({ end: null }));
    expect(withNull.kind).toBe("edit");
    if (withNull.kind === "edit") expect(withNull.fields.end_local).toBeNull();
    // `end` left undefined must not touch the column at all.
    const untouched = planCorrection(row(), base({ start: "2026-10-23T19:00" }));
    if (untouched.kind === "edit") expect("end_local" in untouched.fields).toBe(false);
  });
});

describe("the collision this module exists for", () => {
  it("two Underoath titles differing only by a dash share one identity", () => {
    // 18 Oct 2026. A flag said the 12 Dec row should move to 23 Nov. A 23 Nov row
    // was already published, its title using an em-dash where the other used an
    // en-dash — so the "moved" row's key came out byte-identical. The right
    // action was archiving a duplicate, not moving a date.
    const em = "Underoath — Define the Great Line 20th Anniversary Tour";
    const en = "Underoath – Define the Great Line 20th Anniversary Tour";
    expect(computeEventKey(em, "The Armory", "2026-11-23T18:30")).toBe(
      computeEventKey(en, "The Armory", "2026-11-23T18:30"),
    );

    const dec = row({
      title: en,
      venue: "The Armory",
      city: "Minneapolis",
      start_local: "2026-12-12T19:00",
      end_local: "2026-12-12T23:00",
    });
    const p = planCorrection(dec, base({ id: dec.id, start: "2026-11-23T18:30", end: "2026-11-23T23:00" }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    // The plan surfaces the new identity so the script can refuse it. Nothing
    // here decides the collision — only the DB knows what keys exist.
    expect(p.newKey).toBe("5c833a0d81a696385a69498a8faafea4");
  });
});

describe("validateCorrection", () => {
  it("demands a reason, because the audit row has to say why", () => {
    expect(validateCorrection({ id: "x", why: "", start: "2026-10-23T19:00" })).toMatch(/why/);
    expect(validateCorrection({ id: "", why: "a", start: "2026-10-23T19:00" })).toMatch(/no id/);
  });

  it("refuses a venue change with no coordinates", () => {
    // updateEvent in admin-actions.ts cannot move a pin at all, so a room change
    // made there silently leaves readers pointed at the old address.
    expect(validateCorrection(base({ venue: "Varsity Theater" }))).toMatch(/map pin/);
    expect(
      validateCorrection(base({ venue: "Varsity Theater", lat: 44.98057, lng: -93.236896 })),
    ).toBeNull();
  });

  it("refuses half a coordinate and a pin outside Minnesota", () => {
    expect(validateCorrection(base({ lat: 44.98 }))).toMatch(/go together/);
    expect(validateCorrection(base({ lat: 41.88, lng: -87.63 }))).toMatch(/outside Minnesota/);
    expect(validateCorrection(base({ lat: 44.98, lng: -87.63 }))).toMatch(/outside Minnesota/);
  });

  it("refuses a malformed or inverted time", () => {
    expect(validateCorrection(base({ start: "2026-10-23 20:00" }))).toMatch(/YYYY-MM-DDTHH:MM/);
    expect(validateCorrection(base({ start: "October 23" }))).toMatch(/YYYY-MM-DDTHH:MM/);
    expect(validateCorrection(base({ start: "2026-10-23T20:00", end: "2026-10-23T19:00" }))).toMatch(
      /before start/,
    );
  });

  it("refuses a verified stamp with no cited page", () => {
    // A confirmation resting on nothing is the shape this project keeps catching.
    expect(validateCorrection(base({ start: "2026-10-23T19:00", verified: true }))).toMatch(/needs `evidence`/);
    expect(validateCorrection(base({ start: "2026-10-23T19:00", verified: true, evidence: "   " }))).toMatch(
      /needs `evidence`/,
    );
    expect(
      validateCorrection(
        base({ start: "2026-10-23T19:00", verified: true, evidence: "https://www.varsitytheater.com/shows" }),
      ),
    ).toBeNull();
    // Without the flag, no evidence is required — the stamp just gets cleared.
    expect(validateCorrection(base({ start: "2026-10-23T19:00" }))).toBeNull();
  });

  it("refuses an archive that also edits, and a correction that changes nothing", () => {
    expect(validateCorrection(base({ archive: true, start: "2026-10-23T19:00" }))).toMatch(/cannot be combined/);
    expect(validateCorrection(base({}))).toMatch(/nothing to change/);
    expect(validateCorrection(base({ archive: true }))).toBeNull();
  });
});

describe("describePlan", () => {
  it("shows the identity rewrite, since that is the dangerous part", () => {
    const r = row();
    const p = planCorrection(r, base({ start: "2027-03-14T19:30" }));
    const out = describePlan(p, r).join("\n");
    expect(out).toContain("identity changed");
    expect(out).toContain("2026-10-23T20:00 → 2027-03-14T19:30");
  });

  it("does not claim an identity change for a time-only edit", () => {
    const r = row();
    const out = describePlan(planCorrection(r, base({ start: "2026-10-23T19:00" })), r).join("\n");
    expect(out).not.toContain("identity changed");
  });
});
