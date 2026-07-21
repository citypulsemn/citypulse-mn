"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/seo/site";
import { sendFeedClick } from "./StatBeacon";
import type { FeedSource } from "@/lib/feed-stats";

/**
 * "Subscribe to this calendar" affordance (roadmap 6.1, measured in F2.5).
 *
 * The right UX for a live feed is COPY-THE-URL: paste it into Apple/Google/
 * Outlook's "add by URL" and events keep arriving — a one-time file download
 * wouldn't update. So the button copies the absolute feed URL and both the
 * copy and the direct link fire a `source`-tagged adoption beacon (never-break),
 * so the ops digest can tell which surfaces actually drive calendar subscribes.
 * No login, no email, one quiet line — the no-dark-patterns stance holds.
 */
export function FeedSubscribe({ slug, source }: { slug: string; source: FeedSource }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/feeds/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked (rare) — the direct link below still works
    }
    sendFeedClick(slug, source);
  }

  return (
    <p className="feed-subscribe">
      <a
        href={`/feeds/${slug}`}
        title="iCal feed — add by URL in Apple, Google, or Outlook calendar"
        onClick={() => sendFeedClick(slug, source)}
      >
        📅 Subscribe to this calendar
      </a>
      <button type="button" className="feed-copy" onClick={copy} aria-live="polite">
        {copied ? "Copied ✓ — paste into your calendar app" : "Copy link"}
      </button>
    </p>
  );
}
