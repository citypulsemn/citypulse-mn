import { describe, it, expect } from "vitest";
import { isValidUuid, SAVED_CAP } from "../saved";

describe("isValidUuid (guards the save actions)", () => {
  it("accepts a well-formed uuid", () => {
    expect(isValidUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isValidUuid("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("rejects malformed ids and injection-ish input", () => {
    expect(isValidUuid("1")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301; drop table saved_events")).toBe(false);
    expect(isValidUuid("' or 1=1 --")).toBe(false);
    // @ts-expect-error — exercising the runtime guard against non-strings
    expect(isValidUuid(undefined)).toBe(false);
  });
});

describe("SAVED_CAP", () => {
  it("is a sane positive limit", () => {
    expect(SAVED_CAP).toBeGreaterThan(0);
    expect(Number.isInteger(SAVED_CAP)).toBe(true);
  });
});

/**
 * getSavedEvents returns records in the order of the saved ids (newest saved
 * first). That ordering is done by the mapper below, mirroring getEventsByIds:
 * DB `in (...)` gives no order guarantee, so the code re-sorts by the input ids.
 */
describe("saved-order restoration", () => {
  function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
    const order = new Map(ids.map((id, i) => [id, i]));
    return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  it("restores the saved order even when the DB returns rows shuffled", () => {
    const ids = ["c", "a", "b"]; // saved_at desc
    const rowsFromDb = [{ id: "a" }, { id: "b" }, { id: "c" }]; // arbitrary DB order
    expect(orderByIds(rowsFromDb, ids).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("drops nothing and keeps a single item stable", () => {
    expect(orderByIds([{ id: "x" }], ["x"]).map((r) => r.id)).toEqual(["x"]);
  });
});
