"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy caption" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked — the caption is still selectable in the box */
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
