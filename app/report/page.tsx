import type { Metadata } from "next";
import { TopBar } from "@/components/TopBar";
import { SiteFooter } from "@/components/SiteFooter";
import { ReportForm } from "@/components/ReportForm";
import { getEvent } from "@/lib/events";
import { longDate } from "@/lib/event-view";
import { fmtTime } from "@/lib/dates";

// Reads the DB per request (the event being reported), so it must never be
// prerendered at build time — ENGINEERING rule 2, the Vercel pool stampede.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report a listing — City Pulse MN",
  description:
    "Cancelled, wrong, or a duplicate? Tell us and a person will check the listing.",
  // A utility form, not a search surface: keep it out of the index (and out of
  // app/sitemap.ts) so it never competes with the event pages it serves.
  robots: { index: false, follow: true },
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventId } = await searchParams;
  const event = eventId ? await getEvent(eventId) : null;

  return (
    <>
      <TopBar />

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · corrections</div>
          <h1 className="dayhdr-title">Report a listing</h1>
          <p className="coll-tagline">
            Cancelled, moved, or just wrong? Tell us what happened and a person will check it.
            We&apos;d rather hear it from you than leave someone standing outside a locked door.
          </p>
        </div>

        {event ? (
          <>
            {/* Read-only context, so the reporter can see they're flagging the
                right listing before they send. */}
            <div className="report-context">
              <div className="report-context-label">You&apos;re reporting</div>
              <div className="sub-title">{event.title}</div>
              <div className="sub-meta">
                {[event.venue, event.city].filter(Boolean).join(" · ")}
                {event.start ? ` · ${longDate(event.start.slice(0, 10))} · ${fmtTime(event.start)}` : ""}
              </div>
              <a className="place-source" href={`/event/${event.id}`}>
                View the listing →
              </a>
            </div>

            <ReportForm eventId={event.id} />
          </>
        ) : (
          // No form without a real listing: a report is stored against an event,
          // so an unattached one couldn't be saved. Say that plainly and point the
          // way, rather than showing a form that would fail on submit.
          <div className="report-context">
            <div className="report-context-label">Which listing?</div>
            <p className="sub-meta">
              {eventId
                ? "We couldn't find that listing — it may already have been taken down. If you still see it on the site, open it and use the “Cancelled or wrong?” link at the bottom."
                : "Open the event you mean and use the “Cancelled or wrong?” link at the bottom of its listing — that tells us exactly which one to check."}
            </p>
            <a className="place-source" href="/">
              Browse events →
            </a>
          </div>
        )}

        <SiteFooter source="report" />
      </main>
    </>
  );
}
