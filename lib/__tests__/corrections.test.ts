import { describe, it, expect } from "vitest";
import {
  planCorrection,
  validateCorrection,
  describePlan,
  nextValue,
  type Correction,
  type CorrectionRow,
} from "../corrections";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeEventKey } from "../event-key";
import { isAggregatorSource, isNonScheduleSource } from "../source-trust";

// The real Jigitz row as it stood on 18 Oct 2026, down to the address spelling.
function row(overrides: Partial<CorrectionRow> = {}): CorrectionRow {
  const base: CorrectionRow = {
    id: "e1d69feb-c977-42eb-99ec-ed1937b54552",
    event_key: "af58fe8bae008b8ba8745746ed3c3b63",
    title: "Jigitz – 50 Ballerinas Tour",
    venue: "Green Room",
    city: "Minneapolis",
    address: "2923 Girard Avenue South",
    // Empty is a real state: the column defaults to '' and plenty of rows have it.
    source_url: "",
    start_local: "2026-10-23T20:00",
    end_local: "2026-10-23T23:00",
    multi_day_end: null,
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

  // 28 Oct 2026: four fabricated listings were archived, dropped off every
  // list, and went on serving their own event pages — getEvent filters
  // `status <> 'draft'`, so only `draft` actually takes a page down.
  it("hides, and says nothing when already hidden", () => {
    expect(planCorrection(row(), base({ hide: true })).kind).toBe("hide");
    expect(planCorrection(row({ status: "draft" }), base({ hide: true })).kind).toBe("nothing");
    // An archived row is still showing its page, so hiding it is a real change.
    expect(planCorrection(row({ status: "archived" }), base({ hide: true })).kind).toBe("hide");
  });

  // 28 Oct 2026: the file could take a listing down two ways and put one back
  // none, so the two second nights the multi-day collapse had archived could
  // only be restored by hand in Admin.
  it("restores an archived row, carrying the fixes it needs in the same pass", () => {
    const r = row({ status: "archived" });
    const p = planCorrection(
      r,
      base({ publish: true, evidence: "https://armorymn.com/events/wobbleween-night-2/", end: null }),
    );
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.fields.status).toBe("published");
    expect(p.fields.end_local).toBeNull();
    expect(p.changed.join(" ")).toContain("archived → published");
  });

  it("says nothing when the row is already published", () => {
    expect(
      planCorrection(row(), base({ publish: true, evidence: "https://armorymn.com/events/wobbleween-night-2/" })).kind,
    ).toBe("nothing");
  });

  it("labels a restore unmistakably — it is the one lever that reaches readers", () => {
    const r = row({ status: "archived" });
    const out = describePlan(planCorrection(r, base({ publish: true, evidence: "https://armorymn.com/events/wobbleween-night-2/" })), r);
    expect(out[0]).toContain("PUBLISH");
  });

  it("labels a hide distinctly from an archive", () => {
    const r = row();
    expect(describePlan(planCorrection(r, base({ hide: true })), r)[0]).toContain("HIDE");
    expect(describePlan(planCorrection(r, base({ archive: true })), r)[0]).toContain("ARCHIVE");
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

describe("whether a change can invalidate a verify stamp", () => {
  it("a pin or address fix cannot — the pass never sees those fields", () => {
    // 95 listings needed their pin corrected on 18 Oct 2026. Clearing their
    // stamps would have pushed a week of paid verification back into the queue
    // to re-establish facts the change never touched.
    for (const c of [
      base({ lat: 44.980876, lng: -93.236924 }),
      base({ address: "1308 4th St SE" }),
      base({ address: "1020 Duluth St", lat: 44.9717762, lng: -93.0494985 }),
    ]) {
      const p = planCorrection(row(), c);
      expect(p.kind).toBe("edit");
      if (p.kind === "edit") expect(p.affectsVerification).toBe(false);
    }
  });

  it("a title, venue, city or date change does", () => {
    const cases: Partial<Correction>[] = [
      { title: "Jigitz" },
      { venue: "Varsity Theater", address: "1308 4th St SE", lat: 44.980876, lng: -93.236924 },
      { city: "Saint Paul" },
      { start: "2026-10-24T20:00" },
      { end: "2026-10-24T01:00" },
    ];
    for (const c of cases) {
      const p = planCorrection(row(), base(c));
      expect(p.kind, JSON.stringify(c)).toBe("edit");
      if (p.kind === "edit") expect(p.affectsVerification, JSON.stringify(c)).toBe(true);
    }
  });

  it("a venue move counts even though it also moves the pin", () => {
    // The pin half is invisible to the pass; the venue half is not. Either one
    // being verification-relevant has to win.
    const p = planCorrection(
      row(),
      base({ venue: "Varsity Theater", address: "1308 4th St SE", lat: 44.980876, lng: -93.236924 }),
    );
    if (p.kind === "edit") expect(p.affectsVerification).toBe(true);
  });

  it("refuses to claim a verification a pin fix cannot establish", () => {
    // A geocoder agreeing with another geocoder says where an address is. It
    // says nothing about whether an event is real on that date.
    expect(
      validateCorrection(base({ lat: 44.98, lng: -93.23, verified: true, evidence: "https://nominatim.example/x" })),
    ).toMatch(/cannot see/);
    // The same flag on a date change, with a page cited, is fine.
    expect(
      validateCorrection(
        base({ start: "2027-03-14T19:30", verified: true, evidence: "https://first-avenue.com/event/2027-03-baby-bugs/" }),
      ),
    ).toBeNull();
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

  // 28 Oct 2026: nothing but collapse-multiday could write this column, so a
  // Friday show that the collapse had folded read "Oct 30 – 31" with no
  // operator fix available at all.
  it("sets and clears a run span, and insists on a day", () => {
    const r = row({ multi_day_end: "2026-10-24" });
    // null is a real value here, not an omission: it un-collapses the run.
    const cleared = planCorrection(r, base({ multi_day_end: null }));
    expect(cleared.kind).toBe("edit");
    if (cleared.kind === "edit") {
      expect("multi_day_end" in cleared.fields).toBe(true);
      expect(cleared.fields.multi_day_end).toBeNull();
      // The span is not a field the verify pass is shown, so the stamp stays.
      expect(cleared.affectsVerification).toBe(false);
    }
    expect(planCorrection(r, base({ multi_day_end: "2026-10-24" })).kind).toBe("nothing");
    expect(validateCorrection(base({ multi_day_end: "2026-10-24T23:59" }))).toMatch(/counted in days/);
    expect(validateCorrection(base({ start: "2026-10-30T18:15", multi_day_end: "2026-10-29" }))).toMatch(
      /before the start day/,
    );
    expect(validateCorrection(base({ multi_day_end: null }))).toBeNull();
  });

  it("refuses verified:true on a span-only change, like a pin-only one", () => {
    expect(
      validateCorrection(base({ multi_day_end: null, verified: true, evidence: "https://armorymn.com/events/wobbleween-night-1/" })),
    ).toMatch(/the verify pass cannot see/);
  });

  it("will not restore a listing without the page that says it is real", () => {
    expect(validateCorrection(base({ publish: true }))).toMatch(/needs `evidence`/);
    expect(validateCorrection(base({ publish: true, evidence: "https://armorymn.com/events/wobbleween-night-2/" }))).toBeNull();
    // A restore may carry edits — that is the point, see Correction.publish.
    expect(
      validateCorrection(base({ publish: true, evidence: "https://armorymn.com/events/wobbleween-night-2/", end: null, source_url: "https://armorymn.com/events/wobbleween-night-2/" })),
    ).toBeNull();
    expect(validateCorrection(base({ publish: true, hide: true, evidence: "https://armorymn.com/events/wobbleween-night-2/" }))).toMatch(
      /pick one direction/,
    );
    expect(validateCorrection(base({ publish: true, archive: true, evidence: "https://armorymn.com/events/wobbleween-night-2/" }))).toMatch(
      /pick one direction/,
    );
  });

  it("holds a hide to the same rules, and refuses both levers at once", () => {
    expect(validateCorrection(base({ hide: true }))).toBeNull();
    expect(validateCorrection(base({ hide: true, source_url: "https://armorymn.com/events/jack-white/" }))).toMatch(/hide:true cannot be combined/);
    expect(validateCorrection(base({ archive: true, hide: true }))).toMatch(/pick one/);
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

describe("source_url — repairing a bad citation", () => {
  const VENUE_PAGE = "https://hennepinarts.org/events/the-unauthorized-hallmark-ish-parody-musical-2026";

  it("is an edit the verify pass cannot see, so the stamp survives", () => {
    // The live case, 27 Oct 2026: the listing was right in every fact and cited
    // a touring-Broadway roundup. Clearing verified_at would push a correct row
    // back through a pass that costs about 5p a listing.
    const p = planCorrection(row(), base({ source_url: VENUE_PAGE }));
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.affectsVerification).toBe(false);
    expect(p.newKey).toBeNull();
    expect(p.fields.source_url).toBe(VENUE_PAGE);
    expect(p.changed.some((c) => c.startsWith("source_url:"))).toBe(true);
  });

  it("resets the source check, because the new page has never been read", () => {
    // Without this the weekly sweep sees a fresh stamp, treats the NEW page as
    // checked, and parks it behind every genuinely stale page in a queue that
    // only reaches ~400 of them per run.
    const p = planCorrection(row(), base({ source_url: VENUE_PAGE }));
    expect(p.kind === "edit" && p.resetsSourceCheck).toBe(true);
  });

  it("does not reset the source check for any other kind of edit", () => {
    const pin = planCorrection(row(), base({ lat: 44.9489, lng: -93.2967 }));
    expect(pin.kind === "edit" && pin.resetsSourceCheck).toBe(false);
    const when = planCorrection(row(), base({ start: "2026-10-23T19:00" }));
    expect(when.kind === "edit" && when.resetsSourceCheck).toBe(false);
  });

  it("is a no-op when the row already cites that page", () => {
    const p = planCorrection(row({ source_url: VENUE_PAGE }), base({ source_url: VENUE_PAGE }));
    expect(p.kind).toBe("nothing");
  });

  it("travels with a real fix without disturbing its verification", () => {
    const r = row();
    const p = planCorrection(
      r,
      base({ title: "Jigitz at the Green Room", source_url: VENUE_PAGE, verified: true, evidence: VENUE_PAGE }),
    );
    expect(p.kind).toBe("edit");
    if (p.kind !== "edit") return;
    expect(p.affectsVerification).toBe(true);
    expect(p.resetsSourceCheck).toBe(true);
    // A REAL identity change, not a dash swap. "Jigitz – …" and "Jigitz - …"
    // canonicalize to the SAME key (the Underoath finding above), so asserting
    // `newKey !== event_key` on those passed only because null !== the key.
    expect(p.newKey).toBe(computeEventKey("Jigitz at the Green Room", r.venue, r.start_local));
    expect(p.newKey).not.toBeNull();
  });

  it("counts as a change on its own, so it is not refused as a no-op correction", () => {
    expect(validateCorrection(base({ source_url: VENUE_PAGE }))).toBeNull();
  });

  it("refuses something that is not an http(s) URL with a host", () => {
    for (const bad of ["hennepinarts.org/events", "javascript:alert(1)", "", "https://", "https://localhost"]) {
      expect(validateCorrection(base({ source_url: bad })), bad).toMatch(/not an http\(s\) URL/);
    }
  });

  it("refuses a roundup, which is the defect this field exists to repair", () => {
    // tourstoyou.org is the host that produced the 27 Oct flag.
    expect(validateCorrection(base({ source_url: "https://tourstoyou.org/resources/venues/hennepin-arts/" }))).toMatch(
      /third-party roundup/,
    );
    // …and a subdomain of one, which is how these are usually written.
    expect(validateCorrection(base({ source_url: "https://www.mspmag.com/best-of-october/" }))).toMatch(
      /third-party roundup/,
    );
  });

  it("refuses a reseller dressed up as the venue", () => {
    // Seven live listings sent readers to one of these on 29 Sep 2026.
    expect(
      validateCorrection(base({ source_url: "https://first-avenue.minneapolis-tickets.com/shows" })),
    ).toMatch(/reseller/);
  });

  it("allows a social page, which is citable but not verifiable", () => {
    // isNonScheduleSource is documented as good enough to cite, and source_url
    // stamps nothing. Refusing these would be a new policy, not this one.
    expect(validateCorrection(base({ source_url: "https://www.facebook.com/events/123456" }))).toBeNull();
  });

  it("but still refuses the hosts that are in BOTH lists", () => {
    // eventbrite.com is a directory AND an AGGREGATOR_HOSTS entry, so the
    // roundup rule reaches it first. Stated here because the comment above the
    // checks used to claim every directory was allowed, which was not true.
    expect(isAggregatorSource("https://www.eventbrite.com/e/123")).toBe(true);
    expect(isNonScheduleSource("https://www.eventbrite.com/e/123")).toBe(true);
    expect(validateCorrection(base({ source_url: "https://www.eventbrite.com/e/123" }))).toMatch(/roundup/);
  });

  it("refuses a verified stamp that rests only on a new citation", () => {
    // Pointing at a better page is not a confirmation of a date. The pass never
    // sees source_url, so the stamp is left alone and the claim is refused.
    expect(validateCorrection(base({ source_url: VENUE_PAGE, verified: true, evidence: VENUE_PAGE }))).toMatch(
      /cannot see/,
    );
  });

  it("refuses an archive that also rewrites the citation", () => {
    expect(validateCorrection(base({ archive: true, source_url: VENUE_PAGE }))).toMatch(/source_url/);
  });
});

describe("nextValue — presence decides, never the value", () => {
  /**
   * The bug this exists to stop: `npm run correct` could NEVER clear an end
   * time, and reported that it had. The script wrote
   * `fields.end_local ?? row.end_local`, and `??` falls through on null, so a
   * correction of `{"end": null}` wrote the old timestamp straight back while
   * describePlan printed `→ (none)` and the audit row stored that line.
   *
   * The pre-existing test "can clear an end time without clearing it by
   * accident" stayed green throughout, because it asserted the PLAN — and the
   * plan was always right. Only the write was wrong.
   */
  const plan = (c: Partial<Correction>) => {
    const p = planCorrection(row(), base(c));
    if (p.kind !== "edit") throw new Error("expected an edit");
    return p;
  };

  it("CLEARS a field the plan explicitly set to null", () => {
    const p = plan({ end: null });
    expect(p.fields.end_local).toBeNull();
    expect(nextValue(p.fields, row(), "end_local")).toBeNull();
    // The old expression, kept as a fixture so this test cannot go vacuous.
    expect(p.fields.end_local ?? row().end_local).toBe("2026-10-23T23:00");
  });

  it("keeps the row's value for a field the plan never mentions", () => {
    const p = plan({ start: "2026-10-23T19:00" });
    expect("end_local" in p.fields).toBe(false);
    expect(nextValue(p.fields, row(), "end_local")).toBe("2026-10-23T23:00");
    expect(nextValue(p.fields, row(), "title")).toBe("Jigitz – 50 Ballerinas Tour");
  });

  it("passes a changed value through", () => {
    const p = plan({ start: "2026-10-23T19:00" });
    expect(nextValue(p.fields, row(), "start_local")).toBe("2026-10-23T19:00");
  });

  it("does not coalesce an empty string or a zero away", () => {
    // source_url is `not null default ''`, so "" is a real stored value and a
    // real target. A `?? row.x` here would silently keep the old citation.
    const r = row({ source_url: "https://example.com/old" });
    expect(nextValue({ source_url: "" }, r, "source_url")).toBe("");
    expect(nextValue({ lat: 0 }, r, "lat")).toBe(0);
  });

  it("clears a nullable coordinate the plan nulls, and keeps one it does not", () => {
    const r = row({ lat: 44.9, lng: -93.2 });
    expect(nextValue({ lat: null }, r, "lat")).toBeNull();
    expect(nextValue({}, r, "lat")).toBe(44.9);
  });
});

describe("the script actually uses it — tripwire on scripts/apply-correction.ts", () => {
  /**
   * `nextValue` being correct is worth nothing if the UPDATE goes back to
   * coalescing. And a drift guard that matches nothing is worse than none: one
   * in this repo searched for a literal call that a rename had removed, so
   * `indexOf` returned -1 and it passed for two weeks. Hence the first
   * assertion — prove the statement is found before judging it.
   */
  const src = readFileSync(join(__dirname, "..", "..", "scripts", "apply-correction.ts"), "utf8");
  // Anchored on `event_key  =`, not on `update events set` — the archive
  // statement earlier in the file matches that and was what the first version
  // of this guard sliced out.
  const at = src.indexOf("event_key  =");
  const update = src.slice(at, src.indexOf("where id::text = ${c.id}", at));

  it("finds the UPDATE at all", () => {
    expect(at).toBeGreaterThan(-1);
    expect(update).toContain("event_key  =");
    expect(update.length).toBeGreaterThan(200);
  });

  // The two levers must write DIFFERENT statuses. They did not exist as two
  // levers until 28 Oct 2026, when `archive` was used on four fabrications and
  // every one of them kept serving its event page.
  it("archives to archived and hides to draft, never the same status", () => {
    expect(src).toContain("set status = 'archived', updated_at = now()");
    expect(src).toContain("set status = 'draft', updated_at = now()");
  });

  it("reads every column through nextValue, never through `?? row.`", () => {
    for (const col of ["title", "venue", "city", "address", "source_url", "lat", "lng", "status"]) {
      expect(update, col).toContain(`nextValue(f, row, "${col}")`);
    }
    // The shape that could not tell "clear this" from "not mentioned":
    // coalescing a PLAN FIELD, whose absence and whose null mean different
    // things. `plan.newKey ?? row.event_key` is deliberately still here and is
    // fine — that null has one defined meaning, "identity unchanged".
    expect(update).not.toMatch(/\bf\.\w+\s*\?\?/);
  });

  // Three timestamps since 28 Oct 2026: start_at, end_at and multi_day_end.
  // The count is the point — a new timestamp column added without the ::text
  // cast is what shifts params five hours, so it has to fail loudly.
  it("still casts every timestamp through ::text, or params shift five hours", () => {
    expect(update).toContain("::text::timestamp at time zone 'America/Chicago'");
    expect(update.match(/::text::timestamp/g)?.length).toBe(3);
    for (const col of ["start_at", "end_at", "multi_day_end"]) {
      expect(update, col).toMatch(new RegExp(col + "\\s*="));
    }
  });
});
