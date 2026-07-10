"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  dkey,
  evDate,
  eventsInWindow,
  rangeWindow,
} from "@/lib/dates";
import { searchEvents } from "@/lib/search";
import { applyPriceArea } from "@/lib/filters";
import type { AreaKey } from "@/lib/areas";
import { track } from "@/lib/track";
import type { CategoryKey, EventRecord, PriceTier, RangeKey } from "@/lib/types";
import { Logo } from "./Logo";
import { ControlBar } from "./ControlBar";
import { SearchBox } from "./SearchBox";
import { CategoryChips } from "./CategoryChips";
import { FilterPanel } from "./FilterPanel";
import { CalendarView } from "./CalendarView";
import { DayPanel } from "./DayPanel";
import { EventDetail } from "./EventDetail";

// Map is browser-only (Mapbox GL touches window); never server-render it.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
});

export function EventsExplorer({
  events,
  nowISO,
}: {
  events: EventRecord[];
  nowISO: string;
}) {
  const [now, setNow] = useState(() => new Date(nowISO));
  const [view, setView] = useState<"calendar" | "map">("calendar");
  const [range, setRange] = useState<RangeKey>("month");
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

  // Defer the expensive filtering so the input stays responsive while typing.
  const deferredQuery = useDeferredValue(query);

  // Search narrows the whole dataset; price/area narrow further; then category
  // chips + window. All compose as AND across every surface.
  const searched = useMemo(
    () => searchEvents(events, deferredQuery),
    [events, deferredQuery],
  );
  const filtered = useMemo(
    () => applyPriceArea(searched, prices, areas),
    [searched, prices, areas],
  );

  // Refresh "now" to the client clock after hydration (keeps "today" accurate).
  useEffect(() => {
    setNow(new Date());
  }, []);

  const viewState = useMemo(() => ({ range, year, month }), [range, year, month]);
  const win = useMemo(() => rangeWindow(now, viewState), [now, viewState]);
  const windowedEvents = useMemo(
    () => eventsInWindow(filtered, active, win),
    [filtered, active, win],
  );

  const isSearching = deferredQuery.trim().length > 0;
  const filtersActive = prices.size > 0 || areas.size > 0;
  const isFiltering = isSearching || filtersActive;
  const matchCount = windowedEvents.length;

  const dayEvents = useMemo(() => {
    if (!dayKey) return [];
    return filtered
      .filter((ev) => active.has(ev.category) && dkey(evDate(ev)) === dayKey)
      .sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
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

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <div className="viewtoggle">
            <button
              className={view === "calendar" ? "active" : ""}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
            <button
              className={view === "map" ? "active" : ""}
              onClick={() => setView("map")}
            >
              Map
            </button>
          </div>
        </div>
      </header>

      <div className="wrap">
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
                  {view === "calendar" ? " in this range" : ""} ·{" "}
                  <button className="linklike" onClick={clearAll}>
                    clear all
                  </button>
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

        <CategoryChips active={active} onToggle={toggleCat} onToggleAll={toggleAll} />

        <FilterPanel
          prices={prices}
          areas={areas}
          onTogglePrice={togglePrice}
          onToggleArea={toggleArea}
          onClear={clearAll}
        />

        {view === "calendar" ? (
          <CalendarView
            events={filtered}
            active={active}
            view={viewState}
            now={now}
            onOpenDay={setDayKey}
          />
        ) : (
          <MapView events={windowedEvents} win={win} onPick={(ev) => openDetail(ev, "map")} />
        )}

        <footer>
          Twin Cities metro &nbsp;·&nbsp; <span className="gold">City Pulse MN</span>
        </footer>
      </div>

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
