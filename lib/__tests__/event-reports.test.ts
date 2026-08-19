import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateReport,
  REPORT_KINDS,
  REPORT_KIND_LABELS,
  REPORTER_ROLE_LABELS,
  type ReportInput,
} from "../event-reports";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const EVENT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  eventId: EVENT_ID,
  kind: "cancelled",
  reason: "The venue called it off Friday — it's off their calendar now.",
  evidenceUrl: "",
  reporterEmail: "",
  reporterRole: "",
  ...over,
});

describe("validateReport — the public report form's gate", () => {
  it("accepts a minimal honest report and normalizes it", () => {
    const r = validateReport(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.event_id).toBe(EVENT_ID);
    expect(r.value.kind).toBe("cancelled");
    expect(r.value.reporter_email).toBe("");
    expect(r.value.reporter_role).toBe("");
  });

  it("requires a real event id — junk never reaches the query", () => {
    expect(validateReport(input({ eventId: "" })).ok).toBe(false);
    expect(validateReport(input({ eventId: "not-a-uuid" })).ok).toBe(false);
    expect(validateReport(input({ eventId: "1; drop table events" })).ok).toBe(false);
  });

  it("requires a reason — an unexplained report isn't actionable", () => {
    const r = validateReport(input({ reason: "   " }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.reason).toBeTruthy();
  });

  it("caps the reason so the queue can't be flooded with a novel", () => {
    expect(validateReport(input({ reason: "x".repeat(1001) })).ok).toBe(false);
    expect(validateReport(input({ reason: "x".repeat(1000) })).ok).toBe(true);
  });

  it("only accepts the known kinds", () => {
    for (const k of REPORT_KINDS) expect(validateReport(input({ kind: k })).ok, k).toBe(true);
    expect(validateReport(input({ kind: "delete_everything" })).ok).toBe(false);
    expect(validateReport(input({ kind: "" })).ok).toBe(false);
  });

  it("email is OPTIONAL but must be sane when given (never a barrier to reporting)", () => {
    expect(validateReport(input({ reporterEmail: "" })).ok).toBe(true);
    expect(validateReport(input({ reporterEmail: "venue@example.com" })).ok).toBe(true);
    const bad = validateReport(input({ reporterEmail: "not-an-email" }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.reporterEmail).toBeTruthy();
  });

  it("an unknown role degrades to blank rather than failing the report", () => {
    const r = validateReport(input({ reporterRole: "mayor" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reporter_role).toBe(""); // honest blank, not an invented role
  });

  it("accepts the bare domains people actually paste for evidence", () => {
    const r = validateReport(input({ evidenceUrl: "firstavenue.com/event/123" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.evidence_url).toBe("https://firstavenue.com/event/123");
  });

  it("every kind and role has a human label (the form can't render a raw key)", () => {
    for (const k of REPORT_KINDS) expect(REPORT_KIND_LABELS[k], k).toBeTruthy();
    for (const r of Object.keys(REPORTER_ROLE_LABELS)) {
      expect(REPORTER_ROLE_LABELS[r as keyof typeof REPORTER_ROLE_LABELS], r).toBeTruthy();
    }
  });
});

describe("report wiring — schema, spam protection, entry points, admin queue", () => {
  it("the table is in db/schema.sql, sealed and idempotent", () => {
    const s = read("db/schema.sql");
    expect(s).toContain("create table if not exists event_reports");
    expect(s).toContain("alter table event_reports enable row level security");
    expect(s).toContain("create index if not exists idx_event_reports_status");
    // No anon policy — the public REST API must not see reporter emails.
    expect(s).not.toMatch(/create policy[^;]*event_reports[^;]*anon/i);
    // outcome stays nullable so "not yet decided" != "decided: no change"
    expect(s).toMatch(/outcome\s+text check \(outcome in/);
  });

  it("the anon-visibility check covers the new table", () => {
    expect(read("db/verify-rls.sql")).toContain("from event_reports");
  });

  it("the action runs the honeypot BEFORE the rate limit (bots can't burn a real bucket)", () => {
    const src = read("lib/report-actions.ts");
    const honeypot = src.indexOf('formData.get("company")');
    // "await rateAllow(" is the CALL SITE — plain "rateAllow" also matches the
    // import line at the top of the file, which would make this assertion pass
    // (or fail) for the wrong reason.
    const limit = src.indexOf("await rateAllow(");
    expect(honeypot).toBeGreaterThan(-1);
    expect(limit).toBeGreaterThan(-1);
    expect(honeypot).toBeLessThan(limit);
  });

  it("the honeypot fakes success (silent) while the rate limit is honest", () => {
    const src = read("lib/report-actions.ts");
    // Silent fake-success for bots…
    expect(src).toMatch(/formData\.get\("company"[\s\S]{0,200}status: "success"/);
    // …but a real person who hits the cap is told so. Anchored on the call site.
    expect(src).toMatch(/await rateAllow\([\s\S]{0,300}status: "error"/);
  });

  it("has its own per-IP bucket, tighter than submissions", () => {
    expect(read("lib/rate-limit.ts")).toContain("reportPerIp");
  });

  it("the client form never imports the DB-touching module (build-breaker guard)", () => {
    // lib/event-reports.ts imports `sql` from lib/db, so a client component
    // pulling its constants from there drags `postgres` into the browser bundle
    // and the build dies on "Can't resolve 'net'". This caught it once already.
    const form = read("components/ReportForm.tsx");
    expect(form).toContain('"use client"');
    expect(form).not.toContain("@/lib/event-reports");
    expect(form).toContain("@/lib/report-types");
    // …and the shared vocabulary module must stay DB-free for that to hold.
    const shared = read("lib/report-types.ts");
    expect(shared).not.toContain("./db");
    expect(shared).toContain("REPORT_KIND_LABELS");
  });

  it("the listing carries the report link, in the shared body (modal + page can't drift)", () => {
    const src = read("components/EventDetailBody.tsx");
    expect(src).toContain("/report?event=");
    expect(src).toContain("encodeURIComponent(event.id)");
  });

  it("/for-venues offers it too — venue staff know first when a show is cancelled", () => {
    // The recon called for three entry points; this is the one aimed squarely at
    // the people most likely to have something to report.
    const page = read("app/for-venues/page.tsx");
    expect(page).toContain('href="/report"');
    expect(page).toContain("FOR_VENUES.wrong");
    // …and the copy separates "we never listed it" from "you listed it wrong".
    const ed = read("lib/editorial.ts");
    expect(ed).toContain("wrong:");
    expect(ed).toContain("missing:");
  });

  it("the footer offers the channel too", () => {
    expect(read("components/SiteFooter.tsx")).toContain('href="/report"');
  });

  it("/report is noindex and stays out of the sitemap (a utility form, not a page to rank)", () => {
    expect(read("app/report/page.tsx")).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(read("app/sitemap.ts")).not.toContain("/report");
  });

  it("/report never renders a form it couldn't save (no event = guidance, not a dead form)", () => {
    const src = read("app/report/page.tsx");
    // The form is inside the `event ?` branch only.
    const formAt = src.indexOf("<ReportForm");
    const elseAt = src.indexOf(") : (");
    expect(formAt).toBeGreaterThan(-1);
    expect(formAt).toBeLessThan(elseAt);
  });

  it("the admin queue is registered and offers cancel / hide / dismiss", () => {
    expect(read("components/admin/AdminTabs.tsx")).toContain('href: "/admin/reports"');
    const page = read("app/admin/reports/page.tsx");
    for (const a of ["cancelReportedEvent", "hideReportedEvent", "dismissReport"]) {
      expect(page, a).toContain(a);
    }
    expect(page).toContain("force-dynamic");
    // Honest empty state, not a placeholder.
    expect(page).toContain("No open reports");
  });

  it("acting on a report goes through setStatus/refresh — never a bare revalidate", () => {
    const src = read("lib/admin-actions.ts");
    // 'cancelled' is now an operator-settable status…
    expect(src).toMatch(/"published" \| "draft" \| "archived" \| "cancelled"/);
    // …and each report action changes the event via setStatus (which calls
    // refresh(), clearing BOTH the events data cache and the page cache).
    expect(src).toMatch(/cancelReportedEvent[\s\S]{0,300}setStatus\(eventId, "cancelled"/);
    expect(src).toMatch(/hideReportedEvent[\s\S]{0,300}setStatus\(eventId, "draft"/);
    // Every action records the outcome on the report row itself, because
    // admin_audit has no read path in the app.
    for (const m of ['"actioned", "cancelled"', '"actioned", "hidden"', '"declined", "none"']) {
      expect(src, m).toContain(m);
    }
  });

  it("nothing in the report path deletes an event (archive/status only)", () => {
    for (const f of ["lib/admin-actions.ts", "lib/event-reports.ts", "app/admin/reports/page.tsx"]) {
      expect(read(f), f).not.toMatch(/delete from events/i);
    }
  });
});
