# HOTFIX — background seam on long pages

## What you saw

A hard horizontal line partway down long pages — the page's top glow ending abruptly and a second, clipped copy beginning. Latent since Phase 1; the site's pages only recently got long enough (venue schedules, weekend lists, city pages) for people to scroll past the first copy.

## The cause

The body background was a radial-gradient glow layered over navy:

```css
background:
  radial-gradient(1200px 600px at 50% -10%, rgba(34,51,90,.55), transparent 60%),
  var(--navy-900);
```

A CSS gradient is a background **image**, and background images default to `background-repeat: repeat`. On the body specifically, the background also propagates to the document canvas, and modern browsers size that propagated image in a way that makes it **tile down long documents** — each tile boundary is the hard line in your screenshot.

## The fix

One glow, then flat navy forever — by construction, not by tuning:

```css
html  { background: var(--navy-900); }        /* base coat, incl. overscroll */
body  { background-color: var(--navy-900);
        background-image: radial-gradient(1200px 600px at 50% -10%, rgba(34,51,90,.55), transparent 60%);
        background-repeat: no-repeat; }
```

With `no-repeat`, whatever size any engine chooses for the gradient image, there is only ever **one copy**; everything beyond its fade-out is the flat base color. The failure class is gone regardless of browser or page length. The felt-grain texture (`body::before`, a 120px noise tile) is intentional tiling with invisible seams and is untouched.

## Verification, honestly stated

This container's rendering engine (old WebKit) does not reproduce the modern-browser propagation behavior, so I could not reproduce the seam locally — your screenshot is the reproduction. What I did verify: an isolated 4000px-tall render of the new CSS shows a clean monotonic fade with zero row-to-row brightness jumps (checked programmatically, not by eye), and the full site gate is green (494 tests, clean build, 0 vulnerabilities). The definitive check is yours after deploy: scroll a long page — a venue schedule or /this-weekend — top to bottom.

## Deploy
Unzip over the repo, commit (`Hotfix: non-repeating background glow`) → push.

- [ ] Scroll `/this-weekend` or a busy venue page end to end on your phone: one soft glow at the top, uniform navy the rest of the way, no line.
