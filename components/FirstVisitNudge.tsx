"use client";

import { useEffect, useState } from "react";
import { PLACE_VISIT_COPY } from "@/lib/editorial";
import { VISIT_EVENT } from "./useVisited";

const DISMISSED_KEY = "cp_visitnudge_dismissed";

/**
 * A one-time, dismissible tip shown the first time someone checks a place off
 * (Places P5) — the sibling of FirstSaveNudge, with its own dismissal so a
 * person who waved off the save tip still learns that check-offs can be kept.
 * Points at the keep-list magic link: the check-offs are the first thing on
 * the site a visitor has of their own to lose.
 *
 * No dark patterns: appears only AFTER a deliberate check (never an uncheck),
 * is a status strip (never a modal), and never returns once dismissed.
 */
export function FirstVisitNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }
    const onVisit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.visited) setShow(true); // only on a check, not an uncheck
    };
    window.addEventListener(VISIT_EVENT, onVisit);
    return () => window.removeEventListener(VISIT_EVENT, onVisit);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private mode — fine, it just won't persist */
    }
    setShow(false);
  }

  return (
    <div className="save-nudge" role="status">
      <span>
        {PLACE_VISIT_COPY.nudge} <a href="/saved">{PLACE_VISIT_COPY.nudgeLink}</a>
      </span>
      <button type="button" className="save-nudge-x" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
