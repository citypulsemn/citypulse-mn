import { Logo } from "./Logo";
import { SavedLink } from "./SavedLink";
import type { ReactNode } from "react";

/**
 * The shared header for every non-homepage surface (UX6). Before this, the
 * site's eight sections lived ONLY in the footer, so a visitor arriving from
 * Google onto a venue/neighborhood page couldn't reach "This Weekend" or
 * "Collections" without scrolling past all the event content. This puts a
 * compact, horizontally-scrollable section nav at the TOP of every page, and
 * carries the UX3 "♥ N" saved link everywhere (not just the homepage).
 *
 * The homepage keeps its own interactive topbar — its date presets and category
 * chips ARE its browse controls, so it doesn't need this section strip.
 */
const SECTIONS: { href: string; label: string }[] = [
  { href: "/this-week", label: "This Week" },
  { href: "/this-weekend", label: "This Weekend" },
  { href: "/ongoing", label: "Ongoing" },
  { href: "/collections", label: "Collections" },
  { href: "/places", label: "Places" },
  { href: "/venues", label: "Venues" },
  { href: "/neighborhoods", label: "Neighborhoods" },
  { href: "/cities", label: "Cities" },
];

export function TopBar({ actions }: { actions?: ReactNode }) {
  return (
    <header className="topbar has-nav">
      <div className="topbar-inner">
        <Logo />
        <div className="topbar-actions">
          <SavedLink />
          {actions}
        </div>
      </div>
      <nav className="section-nav" aria-label="Browse sections">
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} className="section-nav-link">
            {s.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
