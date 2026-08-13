import { SubscribeForm } from "./SubscribeForm";

/**
 * SUBSCRIBE BAND (roadmap 3.4) — a slim inline invitation to the weekly
 * digest, dropped where readers already are (the weekend page, venue pages)
 * rather than only in the footer.
 *
 * Deliberately quiet: one band per page, no popup, ever — the no-dark-
 * patterns stance is part of the brand. This is a presentational wrapper
 * around the existing SubscribeForm; the only thing that varies per
 * placement is `source`, which flows through to subscribers.source so the
 * ops digest can report conversion by placement from day one.
 */
export function SubscribeBand({
  source,
  heading = "Get the week's best in your inbox",
  sub = "One email every Thursday — the Twin Cities' best events, hand-picked. Free, no spam.",
}: {
  source: string;
  heading?: string;
  sub?: string;
}) {
  return (
    <section className="subscribe-band" aria-labelledby="subscribe-band-title">
      <div className="subscribe-band-copy">
        <h2 id="subscribe-band-title" className="subscribe-band-title">{heading}</h2>
        <p className="subscribe-band-sub">{sub}</p>
      </div>
      <SubscribeForm source={source} />
    </section>
  );
}
