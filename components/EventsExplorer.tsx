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
import { track } from "@/lib/track";
import type { CategoryKey, EventRecord, RangeKey } from "@/lib/types";
import { Logo } from "./Logo";
import { ControlBar } from "./ControlBar";
import { SearchBox } from "./SearchBox";
import { CategoryChips } from "./CategoryChips";
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

  // Defer the expensive filtering so the input stays responsive while typing.
  const deferredQuery = useDeferredValue(query);

  // Search narrows the whole dataset; category chips + window narrow further.
  const searched = useMemo(
    () => searchEvents(events, deferredQuery),
    [events, deferredQuery],
  );

  // Refresh "now" to the client clock after hydration (keeps "today" accurate).
  useEffect(() => {
    setNow(new Date());
  }, []);

  const viewState = useMemo(() => ({ range, year, month }), [range, year, month]);
  const win = useMemo(() => rangeWindow(now, viewState), [now, viewState]);
  const windowedEvents = useMemo(
    () => eventsInWindow(searched, active, win),
    [searched, active, win],
  );

  const isSearching = deferredQuery.trim().length > 0;
  const matchCount = windowedEvents.length;

  const dayEvents = useMemo(() => {
    if (!dayKey) return [];
    return searched
      .filter((ev) => active.has(ev.category) && dkey(evDate(ev)) === dayKey)
      .sort((a, b) => evDate(a).getTime() - evDate(b).getTime());
  }, [searched, active, dayKey]);

  // Log search terms (no-op until roadmap 1.4 wires analytics).
  useEffect(() => {
    const q = deferredQuery.trim();
    if (q) track("search", { q, results: matchCount });
  }, [deferredQuery, matchCount]);

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
          {isSearching && (
            <div className="search-count">
              {matchCount > 0 ? (
                <>
                  {matchCount} event{matchCount === 1 ? "" : "s"} match
                  {view === "calendar" ? " this range" : ""}
                </>
              ) : (
                <>
                  No matches for “{deferredQuery.trim()}”
                  {view === "calendar" ? " in this range" : ""} ·{" "}
                  <button className="linklike" onClick={() => setQuery("")}>
                    clear search
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

        {view === "calendar" ? (
          <CalendarView
            events={searched}
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
