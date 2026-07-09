import { track as vercelTrack } from "@vercel/analytics";

/**
 * The one analytics entry point the whole app imports. Everything goes through
 * here so the vendor stays swappable (Vercel today; Plausible/umami/first-party
 * later) without touching a single call site.
 *
 * Guarantees:
 *  - No-ops on the server (Vercel Analytics is browser-only).
 *  - Never throws — analytics must never break the UX.
 *  - Only forwards primitive properties (Vercel's requirement).
 */

type Primitive = string | number | boolean | null;

/** Keep only analytics-safe primitive values; stringify anything else. */
export function sanitizeProps(
  props?: Record<string, unknown>,
): Record<string, Primitive> | undefined {
  if (!props) return undefined;
  const out: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v !== undefined) {
      out[k] = String(v);
    }
  }
  return out;
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return; // server: no-op
  try {
    vercelTrack(event, sanitizeProps(props));
  } catch {
    // swallow — a broken analytics call must never affect the page
  }
}
