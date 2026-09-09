"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's saved-event set, shared by every SaveButton on the page.
 *
 * WHY. Each SaveButton used to run its own `fetch("/api/saved")`, so a listing
 * page with 30 event cards fired 30 concurrent requests — each one a
 * force-dynamic lambda taking a Postgres connection. On 9 Sep 2026 that hit
 * Supabase's pooler limit and 17% of /api/saved returned 500s (EMAXCONN).
 * One fetch per page load, no matter how many buttons mount.
 *
 * This is the same store shape as useVisited.ts.
 * ponytail: two near-identical stores; fold into one factory if a third appears.
 */

let snapshot: ReadonlySet<string> | null = null;
let loading = false;
const subs = new Set<() => void>();

const emit = () => {
  for (const s of subs) s();
};

function load() {
  if (loading || typeof window === "undefined") return;
  loading = true;
  fetch("/api/saved")
    .then((r) => r.json())
    .then((d) => {
      const ids: unknown = d?.ids;
      snapshot = new Set(
        Array.isArray(ids) ? ids.filter((s): s is string => typeof s === "string") : [],
      );
    })
    .catch(() => {
      snapshot = snapshot ?? new Set(); // failed → honest empty, never a crash
    })
    .finally(() => {
      loading = false;
      emit();
    });
}

/**
 * Apply a confirmed save/unsave locally. Called by SaveButton after the write
 * lands, so the set stays live WITHOUT another round trip — re-fetching on
 * every toggle is how this got expensive in the first place.
 */
export function applySave(eventId: string, saved: boolean) {
  const next = new Set(snapshot ?? []);
  if (saved) next.add(eventId);
  else next.delete(eventId);
  snapshot = next;
  emit();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (snapshot === null) load();
  return () => {
    subs.delete(cb);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;

/** `null` until hydrated (and always on the server), so cached pages render
 *  identically for every visitor and only the browser learns what is saved. */
export function useSaved(): ReadonlySet<string> | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
