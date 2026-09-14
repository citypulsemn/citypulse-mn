import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOpsEmail, type OpsEmailDeps } from "../notify";

/** Fake Resend endpoint; records every request. */
function fakeSend(result: { ok: boolean; status: number } = { ok: true, status: 200 }) {
  const calls: {
    url: string;
    init: { method: string; headers: Record<string, string>; body: string };
  }[] = [];
  const deps: OpsEmailDeps = {
    fetchJson: async (url, init) => {
      calls.push({ url, init });
      return result;
    },
  };
  return { deps, calls };
}

const ENV = { RESEND_API_KEY: "re_test_key", OPS_DIGEST_TO: "ops@example.com" };
const EMAIL = { subject: "Reels publish — 1 held", lines: ["weird: held", "reason: waived clip"] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendOpsEmail", () => {
  it("POSTs the Resend payload and returns 'sent'", async () => {
    const { deps, calls } = fakeSend();
    const result = await sendOpsEmail(EMAIL, ENV, deps);

    expect(result).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(calls[0].init.body)).toEqual({
      from: "City Pulse Reels <onboarding@resend.dev>",
      to: ["ops@example.com"],
      subject: "Reels publish — 1 held",
      text: "weird: held\nreason: waived clip",
    });
  });

  it("uses DIGEST_FROM when set", async () => {
    const { deps, calls } = fakeSend();
    await sendOpsEmail(EMAIL, { ...ENV, DIGEST_FROM: "City Pulse MN <hello@citypulsemn.com>" }, deps);
    expect(JSON.parse(calls[0].init.body).from).toBe("City Pulse MN <hello@citypulsemn.com>");
  });

  it("missing RESEND_API_KEY → warns the full message, no network, 'logged'", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, calls } = fakeSend();

    const result = await sendOpsEmail(EMAIL, { OPS_DIGEST_TO: "ops@example.com" }, deps);

    expect(result).toBe("logged");
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0][0] as string;
    expect(logged).toContain("RESEND_API_KEY");
    expect(logged).toContain(EMAIL.subject);
    for (const line of EMAIL.lines) expect(logged).toContain(line);
  });

  it("missing OPS_DIGEST_TO → warns naming it, no network, 'logged'", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, calls } = fakeSend();

    const result = await sendOpsEmail(EMAIL, { RESEND_API_KEY: "re_test_key" }, deps);

    expect(result).toBe("logged");
    expect(calls).toHaveLength(0);
    expect(warn.mock.calls[0][0]).toContain("OPS_DIGEST_TO");
  });

  it("Resend non-OK → warns with the status and the message, 'logged', no throw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps } = fakeSend({ ok: false, status: 422 });

    const result = await sendOpsEmail(EMAIL, ENV, deps);

    expect(result).toBe("logged");
    const logged = warn.mock.calls[0][0] as string;
    expect(logged).toContain("422");
    expect(logged).toContain(EMAIL.subject);
  });

  it("a throwing fetch never escapes — 'logged'", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps: OpsEmailDeps = {
      fetchJson: async () => {
        throw new Error("ECONNREFUSED");
      },
    };

    await expect(sendOpsEmail(EMAIL, ENV, deps)).resolves.toBe("logged");
    expect(warn.mock.calls[0][0]).toContain("ECONNREFUSED");
  });

  it("boundary: zero lines still sends, with an empty text body", async () => {
    const { deps, calls } = fakeSend();
    const result = await sendOpsEmail({ subject: "Reels publish — all clear", lines: [] }, ENV, deps);
    expect(result).toBe("sent");
    expect(JSON.parse(calls[0].init.body).text).toBe("");
  });
});
