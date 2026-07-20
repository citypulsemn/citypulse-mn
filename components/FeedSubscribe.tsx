/**
 * "Subscribe to this calendar" affordance (roadmap 6.1). A plain link to the
 * iCal feed for the page's slice — paste it into Apple/Google Calendar's
 * "add by URL" and the events keep arriving. No login, no email. One line,
 * quiet, matching the no-dark-patterns stance.
 */
export function FeedSubscribe({ slug }: { slug: string }) {
  return (
    <p className="feed-subscribe">
      <a href={`/feeds/${slug}`} title="iCal feed — add by URL in Apple, Google, or Outlook calendar">
        📅 Subscribe to this calendar
      </a>
    </p>
  );
}
