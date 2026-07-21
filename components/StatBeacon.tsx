"use client";

import { useEffect, useRef } from "react";
import type { BeaconAction } from "@/lib/stats";

/**
 * Fires one first-party stat beacon on mount (roadmap 5.1). Rendered by the
 * event detail page to count views — running client-side means prefetches and
 * non-JS crawlers don't inflate the numbers.
 *
 * navigator.sendBeacon survives navigation and never blocks the page; the
 * fetch fallback (older browsers) is fire-and-forget with the same contract:
 * analytics must never break the page.
 */
export function StatBeacon({ eventId, action }: { eventId: string; action: BeaconAction }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // React strict-mode double-invoke guard (dev)
    fired.current = true;
    sendStat(eventId, action);
  }, [eventId, action]);

  return null;
}

/** Shared fire-and-forget sender — also used by click handlers. */
export function sendStat(eventId: string, action: BeaconAction): void {
  postBeacon(JSON.stringify({ id: eventId, action }));
}

/** F2.5 — a feed-adoption click ("Subscribe to this calendar"), tagged with
 *  the page surface it fired from. Same fire-and-forget contract. */
export function sendFeedClick(slug: string, source: string): void {
  postBeacon(JSON.stringify({ feed: slug, source }));
}

function postBeacon(body: string): void {
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/beacon", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/beacon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never break the page for a counter
  }
}
