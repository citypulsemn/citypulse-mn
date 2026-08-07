"use client";

import { useEffect, useState } from "react";

/**
 * UX10 — a floating "back to top" for long lists (a full month of events, a
 * busy venue page). Mounted once globally: it only appears after you've scrolled
 * well past a screenful, so short pages never show it. Honors
 * prefers-reduced-motion (jumps instead of smooth-scrolling) — the site-wide
 * motion stance.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
