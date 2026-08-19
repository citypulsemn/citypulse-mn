"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "./db";
import { assertAdmin, logAudit, parseEventPatch } from "./admin";
import { markReportReviewed } from "./event-reports";
import { normalizeTier } from "./event-key";
import { EVENTS_TAG } from "./events";

function requireDb() {
  if (!sql) throw new Error("Database not configured");
  return sql;
}

/** Revalidate the admin views plus the public pages that reflect this event. */
function refresh(id?: string) {
  // Two layers must both clear, or a moderated event lingers:
  //  1) the shared events DATA cache (lib/events.ts) — else pages re-render but
  //     re-read the still-cached getEvents() array;
  //  2) the PAGE cache — with the longer ISR windows (30–60 min) a hidden/
  //     archived event would otherwise sit on the city/venue/day/etc. pages
  //     until their window expired. Admin edits are rare, so clearing the whole
  //     public tree here is cheap and keeps moderation instant everywhere.
  revalidateTag(EVENTS_TAG);
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/event/${id}`);
}

async function setStatus(
  id: string,
  // 'cancelled' joins the union for the report queue (Taren item 2). Until now
  // only the weekly pipeline and the evidence-gated verify pass wrote it; this is
  // the first operator-set cancellation. A cancelled row keeps its page (with the
  // red banner), emits EventCancelled in JSON-LD and STATUS:CANCELLED in the .ics
  // so calendars that already imported it get the update, and drops out of every
  // list, feed, digest and the sitemap.
  status: "published" | "draft" | "archived" | "cancelled",
  action: string,
) {
  await assertAdmin();
  const db = requireDb();
  await db`update events set status = ${status} where id::text = ${id}`;
  await logAudit(action, id, { status });
  refresh(id);
}

export async function hideEvent(formData: FormData) {
  await setStatus(String(formData.get("id")), "draft", "hide");
}

export async function restoreEvent(formData: FormData) {
  await setStatus(String(formData.get("id")), "published", "restore");
}

export async function archiveEvent(formData: FormData) {
  await setStatus(String(formData.get("id")), "archived", "archive");
}

/** Archive one copy of a near-duplicate pair (from the Duplicates tab). */
export async function archiveDuplicate(formData: FormData) {
  await setStatus(String(formData.get("id")), "archived", "archive_duplicate");
}

// ── Removal / correction requests (the Reports tab) ─────────────────────────
// Each action does the same three things in order: change the event, record what
// was decided ON THE REPORT (admin_audit has no read path in the app, so the
// report row is the operator-visible record), and let refresh() clear both cache
// layers. Never a bare revalidatePath here — see refresh()'s comment.

/** Honor a report by marking the event cancelled — the page survives, marked. */
export async function cancelReportedEvent(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await setStatus(eventId, "cancelled", "cancel_reported");
  await markReportReviewed(String(formData.get("id")), "actioned", "cancelled");
  revalidatePath("/admin/reports");
}

/** Honor a report by hiding the event — the URL 404s and the listing vanishes.
 *  Right when something should never have been listed at all. */
export async function hideReportedEvent(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  await setStatus(eventId, "draft", "hide_reported");
  await markReportReviewed(String(formData.get("id")), "actioned", "hidden");
  revalidatePath("/admin/reports");
}

/** Close a report without touching the event (checked, nothing to change). */
export async function dismissReport(formData: FormData) {
  await assertAdmin();
  const note = String(formData.get("note") || "").trim();
  await markReportReviewed(String(formData.get("id")), "declined", "none", note || undefined);
  await logAudit("dismiss_report", String(formData.get("eventId")), { note });
  revalidatePath("/admin/reports");
}

export async function updateEvent(formData: FormData) {
  await assertAdmin();
  const db = requireDb();
  const id = String(formData.get("id"));

  const parsed = parseEventPatch(Object.fromEntries(formData.entries()));
  if (!parsed.ok) throw new Error(parsed.error);
  const p = parsed.patch;

  await db`
    update events set
      title       = ${p.title},
      venue       = ${p.venue},
      city        = ${p.city},
      start_at    = (${p.start}::text::timestamp at time zone 'America/Chicago'),
      end_at      = ${p.end ? db`(${p.end}::text::timestamp at time zone 'America/Chicago')` : null},
      price       = ${p.price},
      price_tier  = ${normalizeTier(p.price)},
      ticket_url  = ${p.ticketUrl},
      description = ${p.description}
    where id::text = ${id}
  `;
  await logAudit("edit", id, { ...p });
  refresh(id);
}
