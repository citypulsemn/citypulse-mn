/**
 * Lightweight analytics seam. Roadmap 1.4 (Analytics) will implement the real
 * provider call inside this function; until then it safely no-ops so call sites
 * (like search-term logging) can exist now without a dependency. The rest of the
 * app only ever imports `track` — the vendor stays swappable behind it.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // no-op until 1.4 wires a provider (Vercel Analytics custom events)
  void event;
  void props;
}
