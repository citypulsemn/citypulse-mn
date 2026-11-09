import type { Place } from "@/lib/places";
import {
  AERIAL_CREDIT,
  AERIAL_CROP_M,
  AERIAL_FLOWN,
  aerialCropUrl,
  aerialPath,
  beforeYouGo,
  factSources,
  type PlaygroundFacts,
} from "@/lib/playground-facts";
import { readOnLabel } from "@/lib/venue-hours";

/**
 * The playground "Before you go" block (lib/playground-facts.ts). A server
 * component with no state: the detail page stays fully static. The photo is a
 * plain <img> of a file in public/ — never next/image, which would route every
 * view through the image optimizer.
 */
export function BeforeYouGo({ place, facts }: { place: Place; facts: PlaygroundFacts }) {
  const lines = beforeYouGo(place, facts);
  if (lines.length === 0 && !facts.aerial) return null;
  const sources = factSources(facts);
  const { width, height } = aerialCropUrl(place.lat, place.lng);

  return (
    <section className="venue-hours before-go">
      <h2 className="venue-hours-head">Before you go</h2>
      {lines.length > 0 && (
        <ul className="venue-hours-list">
          {lines.map((l) => (
            <li key={l.key}>
              {l.text}
              {l.link && (
                <>
                  {" "}
                  <a
                    href={l.link.href}
                    {...(l.link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {l.link.text}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {sources.length > 0 && (
        <p className="venue-hours-src">
          From{" "}
          {sources.map((url, i) => (
            <span key={url}>
              {i > 0 && (i === sources.length - 1 ? " and " : ", ")}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {new URL(url).hostname.replace(/^www\./, "")} ↗
              </a>
            </span>
          ))}
          , read {readOnLabel(facts.readOn)}. Parks change — check before you go.
        </p>
      )}
      {facts.aerial && (
        <figure className="before-go-aerial">
          <img
            src={aerialPath(place.slug)}
            alt={`Aerial photo of ${place.name}, about ${AERIAL_CROP_M.w} by ${AERIAL_CROP_M.h} metres around the play area, April 2025`}
            width={width}
            height={height}
            loading="lazy"
          />
          <figcaption>
            From the air, {AERIAL_FLOWN}, before the leaves came out. It shows the layout, not today&rsquo;s
            condition. Photo: {AERIAL_CREDIT}.
          </figcaption>
        </figure>
      )}
    </section>
  );
}
