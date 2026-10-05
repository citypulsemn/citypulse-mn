import { getSubmissionForDecision, markSubmissionReviewed, markDecidedVia, submissionToDbEvent } from "./submissions";
import { realCorrections, correctedSubmission, type SubmissionCorrections } from "./submission-check";
import { upsertEvents } from "./upsert";
import { geocode } from "./geocode";

/**
 * Turn a reviewed submission into a published event.
 *
 * Shared on purpose. The admin screen and the one-tap link in the inbox email
 * reach the same code, so "approve" means the same thing wherever it is
 * pressed — and `lib/submission-actions.ts` cannot be the home for it because
 * it is a "use server" module gated on assertAdmin, which a signed email link
 * has no session for.
 *
 * `applyCorrections` is the whole point of the check. The two submissions
 * handled by hand in Sep 2026 both needed edits before they were fit to
 * publish; holding those edits on the row means the operator taps once instead
 * of repeating the research.
 */
export type PublishOutcome =
  | { ok: true; title: string; corrected: string[] }
  | { ok: false; reason: "not-found" | "already-decided" | "failed" };

export async function publishSubmission(
  id: string,
  opts: {
    applyCorrections: boolean;
    via: string;
    /**
     * A pin to use INSTEAD of geocoding. There is no MAPBOX_GEOCODING_TOKEN on
     * a laptop, and geocode() returning null makes submissionToDbEvent fall
     * back to the metro centre — a silent, plausible, wrong pin, which is a
     * failure this project has already paid for. An operator publishing from a
     * script passes coordinates they checked themselves.
     */
    geo?: { lat: number; lng: number };
  },
): Promise<PublishOutcome> {
  const sub = await getSubmissionForDecision(id);
  if (!sub) return { ok: false, reason: "not-found" };
  // Idempotent by design: mail clients retry, and a double tap must not
  // publish twice or flip a rejection back to approved.
  if (sub.status !== "pending") return { ok: false, reason: "already-decided" };

  const proposed = (sub.check_corrections ?? {}) as SubmissionCorrections;
  const corrections = opts.applyCorrections ? realCorrections(sub, proposed) : {};
  const fields = correctedSubmission(sub as unknown as Record<string, unknown>, corrections) as unknown as typeof sub;

  try {
    // Geocode whatever address we are actually publishing — the corrected one
    // when there is one, which is how the Animal Farm pin got fixed.
    const geo = opts.geo ?? (await geocode(fields.address || fields.venue, fields.city));
    const event = submissionToDbEvent(
      {
        title: fields.title,
        category: fields.category as never,
        venue: fields.venue,
        city: fields.city,
        address: fields.address,
        start_local: fields.start_local,
        end_local: fields.end_local,
        price: fields.price,
        ticket_url: fields.ticket_url,
        description: fields.description,
        source_url: fields.source_url,
      },
      geo,
    );
    await upsertEvents([event]);
  } catch {
    return { ok: false, reason: "failed" };
  }

  await markSubmissionReviewed(
    id,
    "approved",
    opts.applyCorrections && Object.keys(corrections).length > 0
      ? `published with ${Object.keys(corrections).length} correction(s) from the check`
      : "published as submitted",
  );
  await markDecidedVia(id, opts.via);
  return { ok: true, title: fields.title, corrected: Object.keys(corrections) };
}

export async function rejectSubmission(
  id: string,
  opts: { via: string; note?: string },
): Promise<PublishOutcome> {
  const sub = await getSubmissionForDecision(id);
  if (!sub) return { ok: false, reason: "not-found" };
  if (sub.status !== "pending") return { ok: false, reason: "already-decided" };
  await markSubmissionReviewed(id, "rejected", opts.note);
  await markDecidedVia(id, opts.via);
  return { ok: true, title: sub.title, corrected: [] };
}
