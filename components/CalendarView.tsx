"use client";

import { CATEGORIES } from "@/lib/categories";
import {
  classifyDay,
  dkey,
  eventsByDay,
  isFocus,
  rangeWindow,
} from "@/lib/dates";
import type { CategoryKey, EventRecord, ViewState } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  events,
  active,
  view,
  now,
  onOpenDay,
}: {
  events: EventRecord[];
  active: Set<CategoryKey>;
  view: ViewState;
  now: Date;
  onOpenDay: (dateKey: string) => void;
}) {
  const { year, month } = view;
  const startDay = new Date(year, month, 1).getDay();
  const daysIn = new Date(year, month + 1, 0).getDate();
  const byDay = eventsByDay(events, active);
  const focus = isFocus(view.range);
  const win = rangeWindow(now, view);
  const todayKey = dkey(now);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startDay; i++) {
    cells.push(<div className="cell empty" key={`e${i}`} />);
  }
  for (let d = 1; d <= daysIn; d++) {
    const k = dkey(new Date(year, month, d));
    const evs = byDay[k] ?? [];
    const isToday = k === todayKey;
    let focusClass = "";
    if (focus) focusClass = classifyDay(year, month, d, win);
    const dimClass = !focus && evs.length === 0 ? "dim" : "";

    cells.push(
      <button
        className={`cell ${isToday ? "today" : ""} ${focusClass} ${dimClass}`.trim()}
        key={k}
        onClick={() => onOpenDay(k)}
      >
        <div className="dnum">{d}</div>
        <div className="evs">
          {evs.slice(0, 3).map((ev) => (
            <div
              className="ev-pill"
              key={ev.id}
              style={{ borderLeftColor: CATEGORIES[ev.category].color }}
            >
              {ev.title}
            </div>
          ))}
          {evs.length > 3 && <div className="ev-more">+{evs.length - 3} more</div>}
        </div>
      </button>,
    );
  }

  return (
    <div>
      <div className="cal-head">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="cal-grid">{cells}</div>
    </div>
  );
}
