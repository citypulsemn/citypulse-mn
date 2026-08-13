"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { placesToGeoJSON } from "@/lib/places-map";
import type { Place } from "@/lib/places";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GOLD = "#c9a961";
const NAVY = "#0e1830";
const OSM_GRAY = "#8b93a7";

// Kinds that also get an "every one" bulk layer from OpenStreetMap (public/osm/
// <kind>.json, built by scripts/build-osm-places.ts). These are unbounded — the
// registry holds the hand-picked destinations (gold), and this gray, zoom-gated
// layer shows every community-mapped one. Only playgrounds and parks qualify;
// the other kinds are already exhaustive in the registry.
const OSM_KINDS: Record<string, { plural: string; singular: string }> = {
  playground: { plural: "playgrounds", singular: "playground" },
  park: { plural: "parks", singular: "park" },
};

/**
 * The interactive Places map (P4.2). Pan/zoom, and — the load-bearing choice —
 * native Mapbox GL CLUSTERING via a GeoJSON source, so it scales to the
 * exhaustive coverage plan (thousands of points cluster on the GPU) instead of
 * the old static image's 30-pin cap. mapbox-gl is imported inside the effect so
 * its ~200KB only ships to the client on mount, not in the page bundle.
 *
 * Accessibility: GL cluster layers aren't per-point focusable, so the numbered
 * list below (PlacesList) is the keyboard/screen-reader path — it carries every
 * name, cost, and the source link. The map is the enhancement, the list is the
 * content. Popups deep-link to the matching list row via #slug.
 *
 * No token (local dev) → a short note; the list stands on its own.
 */
export function PlacesMapInteractive({ places }: { places: Place[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const placesRef = useRef(places);
  placesRef.current = places;
  const kind = places[0]?.kind;
  const osm = kind ? OSM_KINDS[kind] : undefined;

  useEffect(() => {
    if (!TOKEN || !containerRef.current || places.length === 0) return;
    let cancelled = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapboxgl: any = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;

      const geojson = placesToGeoJSON(placesRef.current);
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-93.25, 44.95],
        zoom: 9,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
        "top-right",
      );
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("places", { type: "geojson", data: geojson, cluster: true, clusterMaxZoom: 13, clusterRadius: 48 });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": GOLD,
            "circle-opacity": 0.9,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
            "circle-stroke-width": 2,
            "circle-stroke-color": NAVY,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13 },
          paint: { "text-color": NAVY },
        });
        map.addLayer({
          id: "place-point",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": GOLD,
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": NAVY,
          },
        });

        // Fit to all points on load (padding for the controls).
        const bounds = new mapboxgl.LngLatBounds();
        for (const f of geojson.features) bounds.extend(f.geometry.coordinates);
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 12, duration: 0 });

        // Click a cluster → zoom in to break it apart.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "clusters", (e: any) => {
          const feats = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          const clusterId = feats[0]?.properties?.cluster_id;
          if (clusterId == null) return;
          map.getSource("places").getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
            if (err) return;
            map.easeTo({ center: feats[0].geometry.coordinates, zoom });
          });
        });

        // Click a point → popup that deep-links to its list row.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "place-point", (e: any) => {
          const f = e.features[0];
          const p = f.properties as { slug: string; name: string; city: string; cost: string; season: string };
          const html =
            `<div class="pop-place">` +
            `<div class="pop-title">${esc(p.name)}</div>` +
            `<div class="pop-meta">${esc(p.city)} · ${esc(p.cost)} · ${esc(p.season)}</div>` +
            `<a class="pop-link" href="#${encodeURIComponent(p.slug)}">See details ↓</a>` +
            `</div>`;
          new mapboxgl.Popup({ offset: 14, maxWidth: "280px" })
            .setLngLat(f.geometry.coordinates)
            .setHTML(html)
            .addTo(map);
        });

        for (const layer of ["clusters", "place-point"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }

        // The "every one" OSM bulk layer (playgrounds/parks). Fetched at runtime
        // from a static file so it never touches the page bundle; rendered as
        // gray, zoom-gated dots BELOW the gold curated pins (beforeId "clusters").
        // Community data — labeled as such in the caption and popups.
        if (osm) {
          fetch(`/osm/${kind}.json`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (cancelled || !data || !mapRef.current || map.getSource("osm")) return;
              map.addSource("osm", { type: "geojson", data });
              map.addLayer(
                {
                  id: "osm-points",
                  type: "circle",
                  source: "osm",
                  minzoom: 11, // hide until zoomed — the curated gold pins lead
                  paint: {
                    "circle-color": OSM_GRAY,
                    "circle-opacity": 0.85,
                    "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 5.5],
                    "circle-stroke-width": 1,
                    "circle-stroke-color": NAVY,
                  },
                },
                "clusters",
              );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              map.on("click", "osm-points", (e: any) => {
                const f = e.features[0];
                const nm = String(f.properties?.name || "").trim();
                const html =
                  `<div class="pop-place">` +
                  `<div class="pop-title">${esc(nm || `Unnamed ${osm.singular}`)}</div>` +
                  `<div class="pop-meta">Community-mapped · OpenStreetMap</div>` +
                  `</div>`;
                new mapboxgl.Popup({ offset: 10, maxWidth: "240px" })
                  .setLngLat(f.geometry.coordinates)
                  .setHTML(html)
                  .addTo(map);
              });
              map.on("mouseenter", "osm-points", () => (map.getCanvas().style.cursor = "pointer"));
              map.on("mouseleave", "osm-points", () => (map.getCanvas().style.cursor = ""));
            })
            .catch(() => {});
        }
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  if (!TOKEN) {
    return (
      <div className="places-map-note">
        The interactive map loads in production. Every location is in the list below.
      </div>
    );
  }
  if (places.length === 0) return null;
  return (
    <>
      <div ref={containerRef} className="places-map-canvas" aria-label="Interactive map of these locations" />
      {osm && (
        <p className="places-map-osm-note">
          Gold pins are our hand-picked {osm.plural}. <b>Zoom in</b> to see every {osm.singular} in
          the metro (gray dots) — community-mapped via{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>
          .
        </p>
      )}
    </>
  );
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
