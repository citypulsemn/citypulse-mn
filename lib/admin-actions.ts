"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { sql } from "./db";
import { assertAdmin, logAudit, parseEventPatch } from "./admin";
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

async function setStatus(id: string, status: "published" | "draft" | "archived", action: string) {
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
