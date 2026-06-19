import { describe, it, expect } from "vitest";
import { NEW_EVENT_STATUS } from "../pipeline-config";

describe("publish policy", () => {
  it("new events are auto-published", () => {
    expect(NEW_EVENT_STATUS).toBe("published");
  });

  it("is a valid event status", () => {
    expect(["draft", "published", "archived"]).toContain(NEW_EVENT_STATUS);
  });
});
