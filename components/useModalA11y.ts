"use client";

import { useEffect, useRef } from "react";

/**
 * Modal accessibility for the DayPanel / EventDetail overlays (UX7). They were
 * marked role="dialog" aria-modal but never actually behaved modally: keyboard
 * and screen-reader users could Tab straight into the calendar behind them.
 *
 * On open this: moves focus into the dialog, TRAPS Tab within it, locks body
 * scroll, and marks the background `.wrap` inert (so nothing behind is
 * focusable or readable). On close it restores focus to whatever was focused
 * before — the calendar cell / card the user opened from. Returns a ref to put
 * on the dialog element.
 */
export function useModalA11y<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    // Move focus in — the first control, or the dialog itself.
    (focusable()[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);

    // Lock body scroll and inert the background content (the modals are siblings
    // of `.wrap`, so inerting it never touches the dialog).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const wrap = document.querySelector<HTMLElement>(".wrap");
    wrap?.setAttribute("inert", "");

    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      wrap?.removeAttribute("inert");
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
