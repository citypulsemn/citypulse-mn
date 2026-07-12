import { sql } from "./db";
import { CATEGORIES } from "./categories";
import { normalizeTier, computeEventKey } from "./event-key";
import { toIsoWithOffset } from "./seo/event-jsonld";
import { isValidEmail } from "./subscribe";
import { classifyEvent } from "./classify";
import type { CategoryKey, PriceTier, DbEventInput } from "./types";
import type { GeoResult } from "./geocode";

/**
 * Community event submissions (roadmap 3.2). The validators and the
 * submission→event mapper are pure and unit-tested; the DB functions read/write
 * through the owner connection (the table is sealed from the public API).
 */

const VALID_CATEGORIES = new Set(Object.keys(CATEGORIES));
const MAX_FUTURE_DAYS = 400;
// Fallback when geocoding is unavailable — downtown Minneapolis.
export const METRO_CENTER: GeoResult = { lat: 44.9778, lng: -93.265 };

export interface SubmissionInput {
  title: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  endTime?: string; // HH:MM (same day, optional)
  venue: string;
  city: string;
  address?: string;
  price?: string;
  ticketUrl?: string;
  description?: string;
  submitterEmail?: string;
}

export interface CleanSubmission {
  title: string;
  category: CategoryKey;
  venue: string;
  city: string;
  address: string;
  start_local: string;
  end_local: string | null;
  price: string;
  ticket_url: string;
  description: string;
  source_url: string;
  submitter_email: string;
}

export type ValidateResult =
  | { ok: true; value: CleanSubmission }
  | { ok: false; errors: Record<string, string> };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

export function validateSubmission(input: SubmissionInput, now = new Date()): ValidateResult {
  const errors: Record<string, string> = {};
  const t = (v: string | undefined) => (v ?? "").trim();

  const title = t(input.title);
  if (title.length < 3) errors.title = "Please enter the event title (at least 3 characters).";
  else if (title.length > 140) errors.title = "Title is too long (140 characters max).";

  const category = t(input.category);
  if (!VALID_CATEGORIES.has(category)) errors.category = "Please choose a category.";

  const date = t(input.date);
  if (!isDate(date)) {
    errors.date = "Please pick a valid date.";
  } else {
    const day = new Date(`${date}T00:00`);
    const today = new Date(`${now.toISOString().slice(0, 10)}T00:00`);
    const maxDay = new Date(today.getTime() + MAX_FUTURE_DAYS * 86_400_000);
    if (day < today) errors.date = "That date is in the past.";
    else if (day > maxDay) errors.date = "That date is too far out.";
  }

  const time = t(input.time);
  if (!isTime(time)) errors.time = "Please enter a start time.";

  const endTime = t(input.endTime);
  if (endTime && !isTime(endTime)) errors.endTime = "End time isn't valid.";

  const venue = t(input.venue);
  if (!venue) errors.venue = "Where is it? Please add a venue.";
  else if (venue.length > 120) errors.venue = "Venue name is too long.";

  const city = t(input.city);
  if (!city) errors.city = "Please add a city.";
  else if (city.length > 80) errors.city = "City is too long.";

  const address = t(input.address);
  if (address.length > 160) errors.address = "Address is too long.";

  const ticketUrl = t(input.ticketUrl);
  if (ticketUrl && !isHttpUrl(ticketUrl)) errors.ticketUrl = "Link must start with http:// or https://";
  else if (ticketUrl.length > 300) errors.ticketUrl = "Link is too long.";

  const description = t(input.description);
  if (description.length > 1000) errors.description = "Description is too long (1000 characters max).";

  const submitterEmail = t(input.submitterEmail);
  if (submitterEmail && !isValidEmail(submitterEmail.toLowerCase())) {
    errors.submitterEmail = "That email doesn't look right.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      category: category as CategoryKey,
      venue,
      city,
      address,
      start_local: `${date}T${time}`,
      end_local: endTime ? `${date}T${endTime}` : null,
      price: t(input.price) || "See listing",
      ticket_url: ticketUrl,
      description,
      source_url: ticketUrl, // best available "learn more" link
      submitter_email: submitterEmail.toLowerCase(),
    },
  };
}

/** Fields needed to build an event from an approved submission. */
export interface SubmissionEventFields {
  title: string;
  category: CategoryKey;
  venue: string;
  city: string;
  address: string;
  start_local: string;
  end_local: string | null;
  price: string;
  ticket_url: string;
  description: string;
  source_url: string;
}

/** Pure: map an approved submission (+ geocode) to a publishable event row. */
export function submissionToDbEvent(sub: SubmissionEventFields, geo: GeoResult | null): DbEventInput {
  const startISO = toIsoWithOffset(sub.start_local);
  const endISO = sub.end_local ? toIsoWithOffset(sub.end_local) : null;
  const coords = geo ?? METRO_CENTER;
  const priceTier: PriceTier = normalizeTier(sub.price);
  // Roadmap 4.1 — trust the event's content over the submitter's dropdown pick,
  // the same way the pipeline no longer trusts the finding agent's guess.
  const { category } = classifyEvent({
    title: sub.title,
    venue: sub.venue,
    description: sub.description,
    category: sub.category,
  });
  return {
    event_key: computeEventKey(sub.title, sub.venue, startISO),
    title: sub.title,
    category,
    venue: sub.venue,
    address: sub.address,
    city: sub.city,
    lat: coords.lat,
    lng: coords.lng,
    start_at: startISO,
    end_at: endISO,
    price: sub.price,
    priceTier,
    ticket_url: sub.ticket_url,
    description: sub.description,
    image: "",
    source_url: sub.source_url,
    status: "published",
  };
}

// ── DB layer (owner connection; table is sealed from the public API) ──────

export type AddSubmissionResult = "added" | "error";

export interface SubmissionRow extends SubmissionEventFields {
  id: string;
  submitter_email: string;
  created_at: string;
}

export async function addSubmission(clean: CleanSubmission): Promise<AddSubmissionResult> {
  if (!sql) {
    console.warn("[submit] no DATABASE_URL — dev no-op");
    return "added";
  }
  try {
    await sql`
      insert into event_submissions
        (title, category, venue, city, address, start_local, end_local,
         price, ticket_url, description, source_url, submitter_email)
      values
        (${clean.title}, ${clean.category}, ${clean.venue}, ${clean.city}, ${clean.address},
         ${clean.start_local}, ${clean.end_local}, ${clean.price}, ${clean.ticket_url},
         ${clean.description}, ${clean.source_url}, ${clean.submitter_email})
    `;
    return "added";
  } catch (err) {
    console.error("[submit] insert failed:", err);
    return "error";
  }
}

export async function getPendingSubmissions(): Promise<SubmissionRow[]> {
  if (!sql) return [];
  return await sql<SubmissionRow[]>`
    select id, title, category, venue, city, address, start_local, end_local,
           price, ticket_url, description, source_url, submitter_email,
           to_char(created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at
    from event_submissions
    where status = 'pending'
    order by created_at asc
  `;
}

export async function getPendingSubmissionCount(): Promise<number> {
  if (!sql) return 0;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from event_submissions where status = 'pending'
  `;
  return row?.n ?? 0;
}

export async function getSubmissionById(id: string): Promise<SubmissionRow | null> {
  if (!sql) return null;
  const rows = await sql<SubmissionRow[]>`
    select id, title, category, venue, city, address, start_local, end_local,
           price, ticket_url, description, source_url, submitter_email,
           to_char(created_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as created_at
    from event_submissions
    where id::text = ${id} and status = 'pending'
  `;
  return rows[0] ?? null;
}

export async function markSubmissionReviewed(
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<void> {
  if (!sql) return;
  await sql`
    update event_submissions
    set status = ${status}, reviewed_at = now(), review_note = ${note ?? null}
    where id::text = ${id}
  `;
}
