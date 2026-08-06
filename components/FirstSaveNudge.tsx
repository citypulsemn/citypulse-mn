"use client";

import { useEffect, useState } from "react";
import { SAVE_EVENT } from "./SaveButton";

const DISMISSED_KEY = "cp_savenudge_dismissed";

/**
 * A one-time, dismissible tip shown the first time someone saves an event
 * (UX3), pointing them at the keep-list magic link so their list survives a
 * cookie clear or a device switch — the durability feature the audit found was
 * buried. Mounted globally (root layout) so it catches a save from any page.
 *
 * Honors the no-dark-patterns stance: it appears only AFTER a deliberate save,
 * is dismissible, never returns once dismissed (localStorage), and is not a
 * modal — just an unobtrusive bottom strip.
 */
export function FirstSaveNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      return;
    }
    const onSave = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.saved) setShow(true); // only on a save, not an unsave
    };
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
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
        Saved to this browser. <a href="/saved">Email yourself a link</a> to keep your
        list on any device.
      </span>
      <button type="button" className="save-nudge-x" onClick={dismiss} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
