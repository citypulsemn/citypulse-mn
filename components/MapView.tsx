"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { CATEGORIES } from "@/lib/categories";
import { DOW, MONTHS, fmtTime, windowLabel, type DateWindow } from "@/lib/dates";
import type { EventRecord } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapView({
  events,
  win,
  onPick,
}: {
  events: EventRecord[];
  win: DateWindow;
  onPick: (ev: EventRecord) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // init map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-93.25, 44.95],
        zoom: 9.4,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
      drawMarkers(mapboxgl, map, eventsRef.current);
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw markers when the filtered event set changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !TOKEN) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      drawMarkers(mapboxgl, map, events);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function drawMarkers(mapboxgl: any, map: any, evs: EventRecord[]) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (evs.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const ev of evs) {
      const color = CATEGORIES[ev.category].color;

      const el = document.createElement("div");
      el.className = "cp-marker";
      el.style.background = color;

      const node = buildPopupNode(ev, color);
      const popup = new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: "300px" }).setDOMContent(node);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([ev.lng, ev.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([ev.lng, ev.lat]);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 400 });
    }
  }

  function buildPopupNode(ev: EventRecord, color: string): HTMLElement {
    const d = new Date(ev.start);
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="pop-cat" style="color:${color}">${CATEGORIES[ev.category].label}</div>
      <div class="pop-title">${escapeHtml(ev.title)}</div>
      <div class="pop-meta">${escapeHtml(ev.venue)} · ${escapeHtml(ev.city)}</div>
      <div class="pop-meta">${DOW[d.getDay()].slice(0, 3)} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()} · ${fmtTime(ev.start)}</div>
      <div class="pop-meta">${escapeHtml(ev.price)}</div>`;
    const btn = document.createElement("button");
    btn.className = "pop-btn";
    btn.textContent = "View details";
    btn.addEventListener("click", () => onPickRef.current(ev));
    wrap.appendChild(btn);
    return wrap;
  }

  if (!TOKEN) {
    return (
      <div className="map-shell">
        <div className="map-missing">
          <div className="mm-title">Map needs a Mapbox token</div>
          <div className="mm-body">
            Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code> with a public
            Mapbox token, then restart. Until then, the calendar and all event data work fully.
          </div>
        </div>
        <div className="mapcount">
          <b>{events.length}</b> event{events.length !== 1 ? "s" : ""} · {windowLabel(win)}
        </div>
      </div>
    );
  }

  return (
    <div className="map-shell">
      <div id="map" ref={containerRef} />
      <div className="mapcount">
        <b>{events.length}</b> event{events.length !== 1 ? "s" : ""} · {windowLabel(win)}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
