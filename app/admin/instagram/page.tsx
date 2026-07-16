import { getEvents } from "@/lib/events";
import { buildCards, formatCard, renderCaption, CARD_SIZE, type CardVariant } from "@/lib/instagram";
import { weekendDays, weekendLabel, chiDayKey } from "@/lib/weekend";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

/**
 * Admin → Instagram (roadmap 6.4). The Monday research session, generated:
 * the week's three card variants (Regular / Family / Weird) under the locked
 * content rules — exactly five per card, no overlap, no drag/political —
 * with captions that point the bio link at /this-weekend. Copy buttons on
 * everything; the excluded-events report keeps the filtering honest.
 *
 * Out of scope on purpose: b-roll (Pexels, operator-side) and the ISO-week
 * shot/audio rotation (operator-side systems).
 */

const VARIANTS: { key: CardVariant; label: string }[] = [
  { key: "regular", label: "Regular" },
  { key: "family", label: "Family" },
  { key: "weird", label: "Weird" },
];

function next7Days(now: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    chiDayKey(new Date(now.getTime() + i * 86_400_000)),
  );
}

export default async function AdminInstagramPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const useWeekend = sp.window === "weekend";
  const days = useWeekend ? weekendDays(now) : next7Days(now);
  const label = weekendLabel(days);

  const events = await getEvents();
  const cards = buildCards(events, days);

  return (
    <>
      <h2 className="admin-h2">Instagram cards</h2>
      <p className="admin-sub">
        {useWeekend ? "This weekend" : "Next 7 days"} · {label} — locked rules applied:{" "}
        {CARD_SIZE} per card, no overlap, exclusions reported below.{" "}
        <span className="admin-h3-links">
          <a href="/admin/instagram" className={!useWeekend ? "active" : ""}>7 days</a>
          {" · "}
          <a href="/admin/instagram?window=weekend" className={useWeekend ? "active" : ""}>weekend</a>
        </span>
      </p>

      {VARIANTS.map(({ key, label: vlabel }) => {
        const list = cards[key];
        const card = formatCard(list);
        const caption = renderCaption(key, label);
        const short = list.length > 0 && list.length < CARD_SIZE;
        return (
          <section key={key} className="ig-section">
            <h3 className="admin-h3">
              {vlabel} card{" "}
              {short && (
                <span className="ig-warn">
                  only {list.length} of {CARD_SIZE} — thin week for this lane; do not pad
                </span>
              )}
            </h3>
            {list.length === 0 ? (
              <div className="admin-note">Nothing in this lane for the window.</div>
            ) : (
              <>
                <div className="ig-block">
                  <div className="ig-block-head">
                    <span>Card copy</span>
                    <CopyButton text={card} label="Copy card" />
                  </div>
                  <pre className="ig-pre">{card}</pre>
                </div>
                <div className="ig-block">
                  <div className="ig-block-head">
                    <span>Caption</span>
                    <CopyButton text={caption} label="Copy caption" />
                  </div>
                  <pre className="ig-pre">{caption}</pre>
                </div>
              </>
            )}
          </section>
        );
      })}

      <h3 className="admin-h3">Excluded by the rules</h3>
      {cards.excluded.length === 0 ? (
        <div className="admin-note">Nothing was excluded from this window.</div>
      ) : (
        <div className="cov-scroll">
          <table className="cov-table">
            <thead>
              <tr><th>Event</th><th>When</th><th>Rule</th></tr>
            </thead>
            <tbody>
              {cards.excluded.map(({ event, reason }) => (
                <tr key={event.id}>
                  <td><a href={`/event/${event.id}`}>{event.title}</a></td>
                  <td>{event.start.slice(0, 10)}</td>
                  <td>{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-note">
        The two-line format lives in one function (<code>formatCard</code> in{" "}
        <code>lib/instagram.ts</code>) — if the locked card format differs from this
        default, it's a one-place change. B-roll and shot/audio rotation stay in the
        operator workflow by design.
      </div>
    </>
  );
}
