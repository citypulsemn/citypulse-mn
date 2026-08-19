import type { ExplorerView } from "@/lib/explorer-url";
import type { RangeKey } from "@/lib/types";

/**
 * The List / Calendar / Map control, in the two forms the site needs.
 *
 * It used to be three buttons written inline inside `EventsExplorer`, which is
 * mounted on the homepage ONLY — so tapping "This Week" in the header (a real
 * navigation) landed you on a page with no view control at all. It looked like
 * the toggle had vanished. This extracts it so every events surface can carry it.
 *
 * Two modes, because the honest behaviour differs:
 *  - `ViewToggleButtons` — the homepage explorer, where switching view re-renders
 *    the SAME events in place. Interactive, no navigation.
 *  - `ViewToggleLinks` — /this-week, /this-weekend, /ongoing. These pages are
 *    curated shortlists (the Thursday email's picks), not date slices of the whole
 *    database, so Calendar/Map genuinely cannot re-render them in place. They are
 *    ANCHORS back to the homepage explorer at the matching date range — a URL
 *    shape `lib/explorer-url.ts` already serializes and the explorer honors on
 *    mount. Rendering them as links, not buttons, is what keeps that honest: the
 *    control navigates, and looks like it navigates.
 */

const VIEWS: readonly { key: ExplorerView; label: string }[] = [
  { key: "list", label: "List" },
  { key: "calendar", label: "Calendar" },
  { key: "map", label: "Map" },
];

/** The homepage explorer's interactive toggle (switches view in place). */
export function ViewToggleButtons({
  view,
  onSelect,
}: {
  view: ExplorerView;
  onSelect: (v: ExplorerView) => void;
}) {
  return (
    <div className="viewtoggle">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={view === v.key ? "active" : ""}
          aria-pressed={view === v.key}
          onClick={() => onSelect(v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The link form for the other events pages. "List" is the page you're on (marked
 * current); Calendar and Map carry you to the homepage explorer opened on the
 * matching range. Pure markup — no client JS ships for this.
 */
export function ViewToggleLinks({ range, selfHref }: { range: RangeKey; selfHref: string }) {
  return (
    <div className="viewtoggle">
      {VIEWS.map((v) =>
        v.key === "list" ? (
          <a key={v.key} href={selfHref} className="active" aria-current="page">
            {v.label}
          </a>
        ) : (
          <a key={v.key} href={`/?view=${v.key}&range=${range}`}>
            {v.label}
          </a>
        ),
      )}
    </div>
  );
}
