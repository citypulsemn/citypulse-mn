import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderNotifyEmail, type NotifyItem } from "../notify-send";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const item = (over: Partial<NotifyItem> = {}): NotifyItem => ({
  kind: "report",
  title: "Gothic Market",
  detail: "It was cancelled — the venue pulled it Friday.",
  adminPath: "/admin/reports",
  ...over,
});

describe("renderNotifyEmail", () => {
  it("subject names what arrived and which item", () => {
    const { subject } = renderNotifyEmail(item(), "https://citypulsemn.com");
    expect(subject).toBe("New listing report: Gothic Market");
    expect(renderNotifyEmail(item({ kind: "submission" }), "x").subject).toContain(
      "New event submission",
    );
  });

  it("links straight to the queue that can act on it", () => {
    const { html, text } = renderNotifyEmail(item(), "https://citypulsemn.com");
    expect(html).toContain("https://citypulsemn.com/admin/reports");
    expect(text).toContain("https://citypulsemn.com/admin/reports");
  });

  it("tolerates a trailing slash on SITE_URL (no double slash in the link)", () => {
    const { text } = renderNotifyEmail(item(), "https://citypulsemn.com/");
    expect(text).toContain("https://citypulsemn.com/admin/reports");
    expect(text).not.toContain("com//admin");
  });

  it("ESCAPES public input — a report reason is a stranger's HTML, in our inbox", () => {
    const nasty = renderNotifyEmail(
      item({ title: '<img src=x onerror="alert(1)">', detail: 'a & b "quoted" <b>' }),
      "https://citypulsemn.com",
    );
    expect(nasty.html).not.toContain("<img src=x");
    expect(nasty.html).toContain("&lt;img src=x");
    expect(nasty.html).toContain("&amp;");
    expect(nasty.html).toContain("&quot;");
  });

  it("says plainly that nothing has been applied yet", () => {
    const { text, html } = renderNotifyEmail(item(), "x");
    expect(text).toContain("Nothing has been published or changed");
    expect(html).toContain("Nothing has been published or changed");
  });

  it("both formats carry the detail line", () => {
    const { text, html } = renderNotifyEmail(item(), "x");
    expect(text).toContain("It was cancelled");
    expect(html).toContain("It was cancelled");
  });
});

describe("the never-break contract (rule 1) — a notification must not cost a submission", () => {
  const notify = read("lib/notify-send.ts");

  it("sendOperatorNotification catches everything and returns a boolean", () => {
    // Its whole body is wrapped, so an await inside a form action can't throw.
    expect(notify).toMatch(/export async function sendOperatorNotification[\s\S]*try \{/);
    expect(notify).toMatch(/\} catch \(err\) \{[\s\S]*return false;/);
  });

  it("callers log the failure but still return success to the user", () => {
    for (const f of ["lib/report-actions.ts", "lib/submit-actions.ts"]) {
      const src = read(f);
      const notifyAt = src.indexOf("sendOperatorNotification");
      const successAt = src.lastIndexOf('status: "success"');
      expect(notifyAt, f).toBeGreaterThan(-1);
      // The success return comes AFTER the notify call, and the notify result is
      // only ever console-warned — never turned into an error response.
      expect(successAt, f).toBeGreaterThan(notifyAt);
      expect(src, f).toMatch(/if \(!notified\) console\.warn/);
      expect(src, f).not.toMatch(/if \(!notified\)[\s\S]{0,80}status: "error"/);
    }
  });

  it("notifies only AFTER the row is committed (never before the insert)", () => {
    // Anchor on the CALL site — a bare name also matches the import at the top
    // of the file, which would make this pass for the wrong reason.
    const CALL = "await sendOperatorNotification({";
    const rep = read("lib/report-actions.ts");
    expect(rep.indexOf("await addReport(")).toBeLessThan(rep.indexOf(CALL));
    const sub = read("lib/submit-actions.ts");
    expect(sub.indexOf("await addSubmission(")).toBeLessThan(sub.indexOf(CALL));
  });

  it("has a GLOBAL send cap, not just per-IP (rateAllow fails OPEN on db trouble)", () => {
    expect(notify).toContain("notify:operator");
    expect(notify).toMatch(/NOTIFY_LIMIT\s*=\s*\d+/);
  });

  it("the webhook is optional and silent when unset — no error, no noise", () => {
    expect(notify).toContain("NOTIFY_WEBHOOK_URL");
    expect(notify).toMatch(/if \(!url\) return;/);
  });

  it("falls back to OPS_DIGEST_TO so it works with the secret that already exists", () => {
    expect(notify).toContain("process.env.NOTIFY_TO ?? process.env.OPS_DIGEST_TO");
  });

  it("a missing key is logged honestly, not silently swallowed", () => {
    expect(notify).toMatch(/console\.error\([\s\S]{0,200}RESEND_API_KEY/);
  });

  it("both new env vars are documented in .env.example", () => {
    const env = read(".env.example");
    expect(env).toContain("NOTIFY_TO=");
    expect(env).toContain("NOTIFY_WEBHOOK_URL=");
  });
});
