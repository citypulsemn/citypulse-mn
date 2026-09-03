"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's "Been there" set, shared by every component on the page
 * (Places P5). ONE fetch of /api/visited per page load no matter how many
 * buttons and progress lines mount — a kind page has up to 86 rows — and a
 * live update on every toggle via the `citypulse:visit` broadcast.
 *
 * `null` until hydrated (and always on the server), so the statically built
 * places pages render identically for every visitor and only the browser
 * learns who has been where.
 */
export const VISIT_EVENT = "citypulse:visit";

let snapshot: ReadonlySet<string> | null = null;
let loading = false;
let wired = false;
const subs = new Set<() => void>();

const emit = () => {
  for (const s of subs) s();
};

function load() {
  if (loading || typeof window === "undefined") return;
  loading = true;
  fetch("/api/visited")
    .then((r) => r.json())
    .then((d) => {
      const slugs: unknown = d?.slugs;
      snapshot = new Set(
        Array.isArray(slugs) ? slugs.filter((s): s is string => typeof s === "string") : [],
      );
    })
    .catch(() => {
      snapshot = snapshot ?? new Set(); // offline/failed → honest empty, never a crash
    })
    .finally(() => {
      loading = false;
      emit();
    });
}

function onVisit(e: Event) {
  const d = (e as CustomEvent).detail;
  if (!d || typeof d.slug !== "string") return;
  const next = new Set(snapshot ?? []);
  if (d.visited) next.add(d.slug);
  else next.delete(d.slug);
  snapshot = next;
  emit();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!wired) {
    wired = true;
    window.addEventListener(VISIT_EVENT, onVisit);
  }
  if (snapshot === null) load();
  return () => {
    subs.delete(cb);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => null;

export function useVisited(): ReadonlySet<string> | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
