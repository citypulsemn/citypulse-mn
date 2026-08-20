"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  dkey,
  eventsInWindow,
  matchesAfterWindow,
  rangeWindow,
  daysSpanned,
  MONTHS,
} from "@/lib/dates";
import { orderDayEvents } from "@/lib/day-order";
import { SECTIONS } from "@/lib/nav-sections";
import { searchEvents } from "@/lib/search";
import {
  serializeExplorer,
  parseExplorer,
  type ExplorerState,
  type ExplorerDefaults,
  type ExplorerView,
  type ParsedExplorer,
} from "@/lib/explorer-url";
import { applyPriceArea } from "@/lib/filters";
import type { AreaKey } from "@/lib/areas";
import { cityLocations, filterByDistance, DEFAULT_RADIUS_MI, type MetroLocation } from "@/lib/location";
import { LocationControl } from "./LocationControl";
import { MapEventList } from "./MapEventList";
import { ViewToggleButtons } from "./ViewToggle";
import { track } from "@/lib/track";
import type { CategoryKey, EventRecord, PriceTier, RangeKey } from "@/lib/types";
import { Logo } from "./Logo";
import { SavedLink } from "./SavedLink";
import { ControlBar } from "./ControlBar";
import { SearchBox } from "./SearchBox";
import { CategoryChips } from "./CategoryChips";
import { FilterPanel } from "./FilterPanel";
import { CalendarView } from "./CalendarView";
import { ListView } from "./ListView";
import { DayPanel } from "./DayPanel";
import { EventDetail } from "./EventDetail";

// Map is browser-only (Mapbox GL touches window); never server-render it.
// UX10 — a sized placeholder holds the map's height while the ~200KB Mapbox
// chunk loads, so switching to Map doesn't collapse the layout to nothing.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="map-loading skel" aria-busy="true" aria-label="Loading map" />,
});

// UX11 — "make this my default view": the weekly-returning core can pin the
// view + range they always want, restored on the next clean visit (a URL with
// params always wins over it). Just view+range — filters/search stay transient.
const DEFAULT_VIEW_KEY = "cp_default_view";

// U5 — list/week is the UNIVERSAL default so the server-rendered first paint matches
// every device. Previously the SSR default was calendar/month and a mount effect
// swapped phones to list/week, which flashed + shifted layout on every fresh phone
// load (the homepage is ISR-cached, so it can't read the viewport server-side).
// List reads well on both; calendar/month is one tap away and saved if chosen. Keep
// the three uses below (initial state, applyParsed fallback, urlDefaults) in sync.
const DEFAULT_VIEW = "list" as const;
const DEFAULT_RANGE: RangeKey = "week";

interface SavedDefault {
  view: ExplorerView;
  range: RangeKey;
}
const VIEW_VALUES: readonly ExplorerView[] = ["list", "calendar", "map"];
const RANGE_VALUES: readonly RangeKey[] = ["today", "weekend", "week", "month"];

function loadDefaultView(): SavedDefault | null {
  try {
    const o = JSON.parse(localStorage.getItem(DEFAULT_VIEW_KEY) ?? "null");
    if (o && VIEW_VALUES.includes(o.view) && RANGE_VALUES.includes(o.range)) return o;
  } catch {
    // corrupt/blocked storage — fall through to no saved default
  }
  return null;
}

function saveDefaultView(v: SavedDefault): void {
  try {
    localStorage.setItem(DEFAULT_VIEW_KEY, JSON.stringify(v));
  } catch {
    // storage blocked (private mode) — the button just no-ops
  }
}

// U7 — the near-me preference persists across visits (it's "my area", not a
// transient filter). Store just the city KEY + radius; coords are re-derived from the
// current events on restore, so they stay fresh and a city that no longer has events
// simply drops.
const LOCATION_KEY = "cp_location";
function loadLocationPref(): { key: string; radiusMi: number } | null {
  try {
    const o = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? "null");
    if (o && typeof o.key === "string" && typeof o.radiusMi === "number") return o;
  } catch {
    // corrupt/blocked storage
  }
  return null;
}
function saveLocationPref(key: string, radiusMi: number): void {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ key, radiusMi }));
  } catch {
    // storage blocked
  }
}
function clearLocationPref(): void {
  try {
    localStorage.removeItem(LOCATION_KEY);
  } catch {
    // storage blocked
  }
}

export function EventsExplorer({
  events,
  nowISO,
}: {
  events: EventRecord[];
  nowISO: string;
}) {
  const [now, setNow] = useState(() => new Date(nowISO));
  const [view, setView] = useState<"list" | "calendar" | "map">(DEFAULT_VIEW);
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [year, setYear] = useState(() => new Date(nowISO).getFullYear());
  const [month, setMonth] = useState(() => new Date(nowISO).getMonth());
  const [active, setActive] = useState<Set<CategoryKey>>(
    () => new Set(CATEGORY_KEYS),
  );
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventRecord | null>(null);
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Set<PriceTier>>(() => new Set());
  const [areas, setAreas] = useState<Set<AreaKey>>(() => new Set());
  // U7 — near-me: a chosen metro city + radius filters events by proximity.
  const [location, setLocation] = useState<MetroLocation | null>(null);
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI);
  // U6b — the event highlighted from the map's companion list.
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  // UX11 — URL sync is client-only; hold off writing the URL until we've read
  // the initial state from it (below), so the first paint's default state can't
  // clobber shared/reloaded params.
  const [ready, setReady] = useState(false);
  const [isDefault, setIsDefault] = useState(false); // current view/range == saved default

  // Defer the expensive filtering so the input stays responsive while typing.
  const deferredQuery = useDeferredValue(query);

  // UX11 — apply a parsed URL to every piece of state, filling defaults for
  // absent keys (so Back to a barer URL genuinely resets those axes). Used for
  // the initial read and for every popstate (Back/Forward).
  const applyParsed = useCallback(
    (p: ParsedExplorer) => {
      const d = new Date();
      setView(p.view ?? DEFAULT_VIEW);
      setRange(p.range ?? DEFAULT_RANGE);
      setYear(p.year ?? d.getFullYear());
      setMonth(p.month ?? d.getMonth());
      setActive(p.cats ? new Set(p.cats) : new Set(CATEGORY_KEYS));
      setPrices(p.prices ? new Set(p.prices) : new Set());
      setAreas(p.areas ? new Set(p.areas) : new Set());
      setQuery(p.query ?? "");
      setDayKey(p.day ?? null);
      setDetail(p.event ? (events.find((e) => e.id === p.event) ?? null) : null);
    },
    [events],
  );

  // Search narrows the whole dataset; price/area narrow further; then category
  // chips + window. All compose as AND across every surface.
  const searched = useMemo(
    () => searchEvents(events, deferredQuery),
    [events, deferredQuery],
  );
  // U7 — the metro cities that have events (centroids from their own coordinates),
  // for the near-me picker.
  const locations = useMemo(() => cityLocations(events), [events]);
  const filtered = useMemo(() => {
    const pa = applyPriceArea(searched, prices, areas);
    // Near-me is another AND filter: proximity narrows the set, then the window +
    // category chips apply, same as every other axis.
    return location ? filterByDistance(pa, location, radiusMi) : pa;
  }, [searched, prices, areas, location, radiusMi]);

  // Mount: refresh "now" to the client clock, then set the initial state from
  // (in precedence order) the URL, a saved default view, or the mobile default.
  useEffect(() => {
    setNow(new Date());
    const search = window.location.search.replace(/^\?/, "");
    if (search) {
      // A shared link or reload — reproduce exactly what it encodes.
      applyParsed(parseExplorer(search));
    } else {
      const saved = loadDefaultView();
      if (saved) {
        // UX11 — the returning core's pinned view/range.
        setView(saved.view);
        setRange(saved.range);
      }
      // U5 — no viewport-based swap here anymore: list/week is the default for every
      // device (see DEFAULT_VIEW/DEFAULT_RANGE), so the first paint already matches
      // and phones no longer flash from a month calendar to the list.
    }
    setReady(true);
  }, [applyParsed]);

  // U7 — restore the saved near-me preference once (resolving the stored city key
  // against the current cities so the coords stay fresh). Saving happens in the
  // handlers, so this can't race a save on mount.
  const locRestored = useRef(false);
  useEffect(() => {
    if (locRestored.current || locations.length === 0) return;
    locRestored.current = true;
    const pref = loadLocationPref();
    if (!pref) return;
    const match = locations.find((l) => l.key === pref.key);
    if (match) {
      setLocation(match);
      setRadiusMi(pref.radiusMi);
    }
  }, [locations]);

  const pickLocation = useCallback((loc: MetroLocation | null) => {
    setLocation(loc);
    if (loc) saveLocationPref(loc.key, radiusMi);
    else clearLocationPref();
  }, [radiusMi]);
  const changeRadius = useCallback((mi: number) => {
    setRadiusMi(mi);
    if (location) saveLocationPref(location.key, mi);
  }, [location]);
  const clearLocation = useCallback(() => {
    setLocation(null);
    clearLocationPref();
  }, []);

  const viewState = useMemo(() => ({ range, year, month }), [range, year, month]);
  const win = useMemo(() => rangeWindow(now, viewState), [now, viewState]);
  const windowedEvents = useMemo(
    () => eventsInWindow(filtered, active, win),
    [filtered, active, win],
  );

  // UX11 — the whole explorer state, serialized to a canonical query string.
  // Current month is the default, so viewing "now" keeps the URL clean.
  const urlDefaults = useMemo<ExplorerDefaults>(
    () => ({ view: DEFAULT_VIEW, range: DEFAULT_RANGE, year: now.getFullYear(), month: now.getMonth() }),
    [now],
  );
  const stateSig = useMemo(
    () =>
      serializeExplorer(
        { view, range, year, month, cats: active, prices, areas, query, day: dayKey, event: detail?.id ?? null } as ExplorerState,
        urlDefaults,
      ),
    [view, range, year, month, active, prices, areas, query, dayKey, detail, urlDefaults],
  );

  // Write the URL on state change. When the overlay STACK grows (none→day,
  // day→day+event), push a history entry so Back peels exactly one layer; every
  // other change replaces (no Back-button spam while typing/filtering). Overlays
  // are modal, so filters never change under an open one — the writers can't race.
  const prevOverlayCount = useRef(0);
  useEffect(() => {
    if (!ready) return;
    const overlayCount = (dayKey ? 1 : 0) + (detail ? 1 : 0);
    const current = window.location.search.replace(/^\?/, "");
    if (stateSig !== current) {
      const url = stateSig ? `?${stateSig}` : window.location.pathname;
      if (overlayCount > prevOverlayCount.current) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    prevOverlayCount.current = overlayCount;
  }, [ready, stateSig, dayKey, detail]);

  // Back/Forward: re-derive the whole state from wherever the browser landed.
  useEffect(() => {
    const onPop = () => applyParsed(parseExplorer(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyParsed]);

  // Keep the "your default" label truthful as the view/range change.
  useEffect(() => {
    const saved = loadDefaultView();
    setIsDefault(!!saved && saved.view === view && saved.range === range);
  }, [view, range]);

  const isSearching = deferredQuery.trim().length > 0;
  const filtersActive = prices.size > 0 || areas.size > 0 || location !== null;
  const isFiltering = isSearching || filtersActive;
  const matchCount = windowedEvents.length;

  // UX9 — cross-month search: when the current window is empty but the query
  // (or filters) DO match events further out, offer a jump instead of a
  // dead-end "no matches". Only computed when the window is empty.
  const ahead = useMemo(
    () => (isFiltering && matchCount === 0 ? matchesAfterWindow(filtered, active, win) : null),
    [isFiltering, matchCount, filtered, active, win],
  );

  const dayEvents = useMemo(() => {
    if (!dayKey) return [];
    // MUST match the calendar cells' rule (eventsByDay → daysSpanned): the cell
    // showed spanning events but this panel filtered by start day only, so
    // clicking a day could open an empty panel under a full-looking cell.
    // Ordering (spans first, then timed by clock) is shared with the /day/[date]
    // page via orderDayEvents so the two surfaces always agree (U2).
    return orderDayEvents(
      filtered.filter((ev) => active.has(ev.category) && daysSpanned(ev).includes(dayKey)),
      dayKey,
    );
  }, [filtered, active, dayKey]);

  // Log search terms (no-op until roadmap 1.4 wires analytics).
  useEffect(() => {
    const q = deferredQuery.trim();
    if (q) track("search", { q, results: matchCount });
  }, [deferredQuery, matchCount]);

  function togglePrice(t: PriceTier) {
    track("price_toggle", { tier: t });
    setPrices((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  function toggleArea(a: AreaKey) {
    track("area_toggle", { area: a });
    setAreas((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  }

  function clearAll() {
    setQuery("");
    setPrices(new Set());
    setAreas(new Set());
    setLocation(null);
    clearLocationPref();
  }

  // Escape closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detail) setDetail(null);
      else if (dayKey) setDayKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, dayKey]);

  function handleRange(r: RangeKey) {
    track("preset_select", { preset: r });
    setRange(r);
    if (r !== "month") {
      const w = rangeWindow(now, { range: r, year, month });
      setYear(w.start.getFullYear());
      setMonth(w.start.getMonth());
    }
  }

  function openDetail(ev: EventRecord, surface: "calendar" | "map") {
    track("event_open", { id: ev.id, category: ev.category, surface });
    setDetail(ev);
  }

  // UX9 — jump the window to the month holding the next matching event, keeping
  // the query/filters in place so those matches are what shows on arrival.
  function jumpToMonth(target: Date) {
    track("search_jump", { to: dkey(target) });
    setRange("month");
    setYear(target.getFullYear());
    setMonth(target.getMonth());
  }

  function handleMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
    setRange("month");
  }

  function toggleCat(k: CategoryKey) {
    track("chip_toggle", { category: k });
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size === 0 ? new Set(CATEGORY_KEYS) : next;
    });
  }

  function toggleAll() {
    setActive((prev) =>
      prev.size === CATEGORY_KEYS.length ? new Set<CategoryKey>() : new Set(CATEGORY_KEYS),
    );
  }

  // UX11 — pin the current view + range as this browser's default landing state.
  function makeDefault() {
    saveDefaultView({ view, range });
    setIsDefault(true);
    track("set_default_view", { view, range });
  }

  return (
    <>
      <header className="topbar has-nav">
        <div className="topbar-inner">
          <Logo />
          <div className="topbar-actions">
            <SavedLink />
            <ViewToggleButtons view={view} onSelect={setView} />
          </div>
        </div>
        {/* U3 — the browse sections, previously footer-only on the homepage. Same
            section-nav the shared TopBar gives every other page (SECTIONS is the
            single source of truth), so Places/Collections/etc. are reachable from
            the top, not buried at the bottom. */}
        <nav className="section-nav" aria-label="Browse sections">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="section-nav-link">
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="wrap">
        <h1 className="sr-only">This week in the Twin Cities — events, concerts &amp; things to do</h1>
        <div className="searchrow">
          <SearchBox value={query} onChange={setQuery} />
          {isFiltering && (
            <div className="search-count">
              {matchCount > 0 ? (
                <>
                  {matchCount} event{matchCount === 1 ? "" : "s"} match
                  {view === "calendar" ? " this range" : ""}
                </>
              ) : (
                <>
                  {isSearching ? (
                    <>No matches for “{deferredQuery.trim()}”</>
                  ) : (
                    <>No events match these filters</>
                  )}
                  {view === "calendar" ? " in this range" : ""}
                  {ahead ? (
                    <>
                      {" · "}
                      <button
                        className="linklike"
                        onClick={() => jumpToMonth(ahead.firstDate)}
                      >
                        {ahead.count} match{ahead.count === 1 ? "" : "es"} in{" "}
                        {MONTHS[ahead.firstDate.getMonth()]}
                        {ahead.firstDate.getFullYear() !== now.getFullYear()
                          ? ` ${ahead.firstDate.getFullYear()}`
                          : ""}{" "}
                        →
                      </button>
                    </>
                  ) : (
                    <>
                      {" · "}
                      <button className="linklike" onClick={clearAll}>
                        clear all
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <ControlBar
          range={range}
          year={year}
          month={month}
          onRange={handleRange}
          onMonth={handleMonth}
        />

        <div className="default-view-row">
          <button
            type="button"
            className="default-view-btn"
            onClick={makeDefault}
            aria-pressed={isDefault}
            title="Open the site to this view and range next time"
          >
            {isDefault ? "✓ Your default view" : "Make this my default"}
          </button>
        </div>

        <CategoryChips active={active} onToggle={toggleCat} onToggleAll={toggleAll} />

        <FilterPanel
          prices={prices}
          areas={areas}
          onTogglePrice={togglePrice}
          onToggleArea={toggleArea}
          onClear={clearAll}
        />

        <LocationControl
          locations={locations}
          value={location}
          radiusMi={radiusMi}
          onPick={pickLocation}
          onRadius={changeRadius}
          onClear={clearLocation}
        />

        {view === "calendar" ? (
          <CalendarView
            events={filtered}
            active={active}
            view={viewState}
            now={now}
            onOpenDay={setDayKey}
          />
        ) : view === "list" ? (
          <ListView events={windowedEvents} windowStartKey={dkey(win.start)} />
        ) : (
          <div className="map-split">
            <MapView
              events={windowedEvents}
              win={win}
              focusId={mapFocusId}
              onPick={(ev) => openDetail(ev, "map")}
            />
            <MapEventList events={windowedEvents} focusId={mapFocusId} onFocus={setMapFocusId} />
          </div>
        )}

        <div className="explorer-tagline">
          Twin Cities metro &nbsp;·&nbsp; <span className="gold">City Pulse MN</span>
        </div>
      </main>

      {dayKey && (
        <DayPanel
          dateKey={dayKey}
          events={dayEvents}
          onPick={(ev) => openDetail(ev, "calendar")}
          onClose={() => setDayKey(null)}
        />
      )}
      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
