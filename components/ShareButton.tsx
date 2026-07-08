"use client";

import { useState } from "react";

/**
 * Shares the canonical event URL. Uses the native Web Share sheet on mobile,
 * falls back to copying the link on desktop. `url` may be a path (e.g.
 * "/event/123") — the absolute URL is resolved from the current origin.
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const abs =
      typeof window !== "undefined" ? new URL(url, window.location.origin).href : url;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: abs });
      } catch {
        /* user cancelled — no-op */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button type="button" className="sharebtn" onClick={onShare} aria-label="Share this event">
      {copied ? "Link copied ✓" : "↗ Share"}
    </button>
  );
}
