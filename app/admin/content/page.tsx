import { getEvents } from "@/lib/events";
import { weeklyPicks } from "@/lib/content/weekly-picks";
import { captionFor, weeklyCaptionFor } from "@/lib/content/templates";
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
  const events = await getEvents();
  const picks = weeklyPicks(events, new Date());
  const nothing = picks.all.length === 0;

  return (
    <>
      <p className="admin-intro">
        Your week&apos;s Instagram kit, generated from the live event database. Copy a caption,
        download the 1080×1350 card, post. Cards refresh whenever the data does.
      </p>

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
