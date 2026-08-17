import { getEvents } from "@/lib/events";
import { weeklyPicks } from "@/lib/content/weekly-picks";
import { captionFor, weeklyCaptionFor, placeCaptionFor, collectionCaptionFor } from "@/lib/content/templates";
import { placeOfTheWeek } from "@/lib/places";
import { getCollection, selectCollection } from "@/lib/collections";
import { CopyButton } from "@/components/admin/CopyButton";

export const dynamic = "force-dynamic";

function CardBlock({
  title,
  cardUrl,
  caption,
  downloadName,
}: {
  title: string;
  cardUrl: string;
  caption: string;
  downloadName: string;
}) {
  return (
    <section className="content-block">
      <div className="content-head">{title}</div>
      <div className="content-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="content-card" src={cardUrl} alt="Instagram card preview" width={1080} height={1350} />
        <div className="content-side">
          <textarea className="content-caption" readOnly value={caption} rows={11} />
          <div className="content-actions">
            <CopyButton text={caption} />
            <a className="admin-btn" href={cardUrl} download={downloadName}>
              Download card
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function AdminContentPage() {
  const now = new Date();
  const events = await getEvents();
  const picks = weeklyPicks(events, now);
  const nothing = picks.all.length === 0;

  // Evergreen cards — extend the kit past events to the "where to go" half and
  // the demand-validated topic pages (both new; the Places/collections verticals
  // had zero social presence).
  const place = placeOfTheWeek(now);
  const ftfCollection = getCollection("food-truck-festivals");
  const ftfSample = ftfCollection ? selectCollection(events, ftfCollection, now) : [];

  return (
    <>
      <p className="admin-intro">
        Your week&apos;s Instagram kit, generated from the live event database. Copy a caption,
        download the 1080×1350 card, post. Cards refresh whenever the data does.
      </p>

      {/* Evergreen cards — render regardless of the 7-day event window (Places is
          registry-based; the collection has its own season). */}
      {place && (
        <CardBlock
          title="Place of the week"
          cardUrl={`/content/place/${place.slug}`}
          caption={placeCaptionFor(place)}
          downloadName={`citypulse-place-${place.slug}.png`}
        />
      )}

      {ftfCollection && (
        <CardBlock
          title={ftfCollection.title}
          cardUrl={`/content/collection/${ftfCollection.slug}`}
          caption={collectionCaptionFor(ftfCollection, ftfSample)}
          downloadName="citypulse-food-trucks.png"
        />
      )}

      {nothing ? (
        <div className="admin-empty">No published events in the next 7 days yet.</div>
      ) : (
        <>
          <CardBlock
            title="This Week — roundup"
            cardUrl="/content/week"
            caption={weeklyCaptionFor(picks)}
            downloadName="citypulse-week.png"
          />

          {picks.family && (
            <CardBlock
              title="Family pick"
              cardUrl={`/content/card/${picks.family.id}?label=family`}
              caption={captionFor(picks.family, "family")}
              downloadName="citypulse-family.png"
            />
          )}

          {picks.unique && (
            <CardBlock
              title="Uniquely MN pick"
              cardUrl={`/content/card/${picks.unique.id}?label=unique`}
              caption={captionFor(picks.unique, "unique")}
              downloadName="citypulse-unique.png"
            />
          )}

          {picks.regular.length > 0 && <h3 className="admin-h3">On the radar</h3>}
          {picks.regular.map((e) => (
            <CardBlock
              key={e.id}
              title={e.title}
              cardUrl={`/content/card/${e.id}?label=regular`}
              caption={captionFor(e, "regular")}
              downloadName={`citypulse-${e.id}.png`}
            />
          ))}
        </>
      )}
    </>
  );
}
