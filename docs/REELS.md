# REELS.md — Automated Instagram Reels pipeline

**Status:** built and smoke-verified locally (Aug 27, 2026). Waiting on two API
keys to go live. One command produces a posting day's three finished reels.

## What shipped

`npm run reels` replicates the entire manual weekly reels operation
(toolkit prompts → B-Roll Finder → card generator → CapCut) as one pipeline:

1. **Events** — pulls the window's published events from the site DB
   (`lib/reels/load-events.ts`), brand-screens them (no political events, no
   drag events), routes them into regular/family/weird pools with the family
   gate (nothing 7 PM or later, no 21+, no bar venues), and picks 5 per
   variant with variety scoring (`select-events.ts`).
2. **Web top-up** — when a pool is short (weird usually is: the DB often has
   0–1 weird events in a window), a Claude web-search agent finds the
   shortfall, and every returned row is re-screened **in code**, not just by
   prompt (`research-topup.ts`).
3. **Copywriting** — one Claude call per reel writes the card names (variant
   voice: clear / tired-parent / periods-as-beats absurdity), the caption, and
   the Pexels term plan with the weekly shot-type rotation. A pure validator
   enforces every card rule (exactly 5 events, price never split, no
   hashtags/dashes/emoji, banned footage terms, seasonal lock) with one
   retry, then hard-fails rather than ship an invalid card
   (`prompts.ts`, `copywriter.ts`, `validate.ts`, `format.ts`).
4. **Card** — composites text onto the owner's REAL blank template PNGs
   (`assets/reels/template-{regular,family,weird}.png`, copied from
   `Documents\CityPulseMN\content_card_template*.png` — the same artwork used
   in the manual CapCut builds), placed at the exact position/scale measured
   from the published reels. Nothing is drawn except the text, so the finish
   (paper texture, dome shading, medallion, gold lines) is pixel-identical
   (`card.ts`). Text is Bebas Neue at weight 400 — zoomed letterform
   comparison against the published reels identified it (the toolkit/handoff's
   "Anton" guess renders visibly fatter; Oswald was closer but ~20% too wide;
   and requesting bold from the single-weight Bebas makes canvas synthesize a
   fake heavier face, so keep it at 400). If the template art ever changes,
   replace those three PNGs and re-measure the separator lines (constants at
   the top of card.ts).
5. **B-roll** — Pexels API with the B-Roll Finder's exact file-pick logic,
   plus what you used to do by eye: a Claude-vision screen over every
   candidate's thumbnail that checks BOTH authenticity (no palms, mountains,
   ocean, Europe) and **season** — no snow in a summer reel, no lush lake
   scenes in January; indoor shots are always season-neutral. The season
   wording rotates with the window's month (`seasonScreenNote`). Also: 21-day
   term and 42-day clip no-repeat windows, per-reel dedupe (`pexels.ts`,
   `authenticity.ts`, `history.ts`). The seasonal lock is enforced at three
   layers — the copywriter prompt, the term validator, and this footage
   screen, which is the one that actually looks at the pixels.
6. **Assembly** — ffmpeg: seven ~5.1s slots, 0.4s crossfades, 15% dim, static
   card overlay, optional music, 33.07s 1080×1920@30fps H.264 — the exact
   fixed template of the published reels (`timeline.ts`, `assemble.ts`).
7. **Music** — every reel ships with copyright-free music baked in (the
   owner's call: no trending audio needed). The banks at
   `Documents\CityPulseMN\Audio\<variant>\` are stocked with 23 public-domain
   (CC0) tracks from the FreePD catalog, mood-matched per variant — upbeat
   for regular, ukulele-warm for family, goofy for weird ("Wakka Wakka",
   "Happy Whistling Ukulele"…). Rotation: 28-day no-repeat, deterministic
   weekly pick, loudness-normalized to -14 LUFS with fades (`audio.ts`).
   Empty folder ⇒ silent export (fallback only). Provenance + license notes:
   `Audio\README.txt`.

Output lands in `Documents\CityPulseMN\Reels\auto\<windowStart>_<day>\`:
`regular.mp4`, `family.mp4`, `weird.mp4`, one `*.caption.txt` each, and a
`manifest.md` that honestly reports everything — events chosen, every
exclusion with its reason, warnings (especially `AUTHENTICITY WAIVED`), audio
used, and any reel that could not be built. A reel with fewer than 5 valid
events is **skipped, never padded** — the manifest says so.

## Design decisions (and why)

- **Published reels are ground truth, not the toolkit.** Where they disagree
  (no variant badges, merged header+date line, white "FULL GUIDE AT
  CITYPULSEMN.COM" CTA on every variant, Monday-weird header without
  "(WAIT, WHAT?)"), the code matches the account. → *Taren: the toolkit HTML's
  Reels tab now lags the real format; update it when convenient.*
- **Name cap is 7 words.** Toolkit says 5, its own example is 6, and the live
  cards run to 7 ("Kids Earn Market Money at Pop Club").
- **True ISO week** drives the shot-type/audio keys. The toolkit's "(Jan 1 =
  week 1)" parenthetical contradicts its own "ISO week" instruction; code
  sides with ISO. Only affects rotation, never content.
- **DB first, web second.** Site DB events are already verified by the weekly
  pipeline; the top-up only fills gaps. Reels and site stay in sync with the
  "Full guide at citypulsemn.com" CTA.
- **Authenticity waiver.** If every candidate for a line fails the vision
  screen, the best-ranked one ships with a loud `⚠ AUTHENTICITY WAIVED` line
  in the manifest rather than killing the whole reel. You review reels before
  posting anyway (phase 1 is manual posting) — check the manifest first.
- **Friday reels are generated Friday morning**, not Monday: they use the
  freshest event data (the Monday verify pass has run; cancellations caught).
  `--day=friday` on Monday still works if you prefer one session.

## Go-live checklist (one-time, ~10 minutes)

1. Add two lines to `.env.local` (type carefully — see the phone-editing
   hazard note; each value is one unbroken string, no quotes needed):
   - `ANTHROPIC_API_KEY=` … same key the GitHub Actions pipeline uses.
   - `PEXELS_API_KEY=` … the key saved in your B-Roll Finder (open
     `city_pulse_broll_finder.html` — the key field shows it), or a fresh one
     from pexels.com/api.
2. Music: already stocked — 23 public-domain tracks across
   `Documents\CityPulseMN\Audio\{regular,family,weird}\`. Skim the folders
   and delete anything that doesn't fit your ear; add your own licensed
   tracks any time (README there explains the rotation).
3. ffmpeg is already installed (winget, `Gyan.FFmpeg`); the pipeline finds it
   automatically. `FFMPEG_PATH` env var overrides if you ever move it.
4. Test one real run:

```bash
npm run reels -- --variant=regular
```

   Watch the reel, read `manifest.md`, then run the full day:

```bash
npm run reels
```

## Scheduling (Windows Task Scheduler)

When you're happy with the output, schedule Monday + Friday 6:30 AM (PC must
be on/awake; skip this and run manually if you prefer):

```bash
schtasks /Create /TN "CityPulse Reels Monday" /SC WEEKLY /D MON /ST 06:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run reels >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\run.log 2>&1"
```

```bash
schtasks /Create /TN "CityPulse Reels Friday" /SC WEEKLY /D FRI /ST 06:30 /TR "cmd /c cd /d C:\Users\mccul\Documents\Event_Site\citypulse-mn && npm run reels >> C:\Users\mccul\Documents\CityPulseMN\Reels\auto\run.log 2>&1"
```

Posting stays a 2-minute phone/desktop step: open the day's folder, check
`manifest.md` for ⚠ lines, watch each reel, paste each caption, post.
(Instagram.com on desktop posts reels fine.) Every reel already carries its
music.

## Weekly verify checklist

- `manifest.md` has no `FAILED` section and no unexplained `SKIPPED`.
- Any `⚠ AUTHENTICITY WAIVED` clip: watch that segment — does it read as
  Minnesota? If not, delete the reel or rebuild (`--variant=<name>` reruns
  just one variant).
- Weird card: the top-up found real events (spot-check one source URL from
  the manifest).
- Captions: no hashtags, no dashes — the validator enforces this, but the
  voice is worth a skim.

## Rollback

No schema changes, no site-code changes, nothing deployed — the site is
untouched. To remove entirely: delete `lib/reels/`, `scripts/reels/`,
`assets/reels/`, the `"reels"` line in package.json, and
`npm uninstall @napi-rs/canvas`; `schtasks /Delete /TN "CityPulse Reels Monday" /F`
(and Friday) if scheduled. Generated output under `Documents\CityPulseMN\Reels\auto\`
is yours to keep or delete.

## Phase 2 (not built): auto-posting

The generator was designed so posting can be bolted on: each day-folder has
the mp4 + caption ready. Instagram's Content Publishing API needs your
account switched to Professional, linked to a Facebook Page, and a Meta app
with an access token (~30 min one-time). Two constraints to decide with open
eyes: API-posted reels can only use audio baked into the file (no trending
sounds), and the video must be fetchable from a public URL (we'd upload to
Supabase storage briefly — mind the egress budget). Ask Claude for this when
you want it.

## Known limits (honest)

- The weird card depends on the web top-up most weeks (DB had 1 weird event
  for Aug 24–28, 7 for Aug 31–Sep 4). If the top-up can't verify 5 genuinely
  weird events, that reel is skipped and the manifest says why.
- Live Pexels/Anthropic paths are exercised by golden tests + the smoke run,
  not yet by a full live run — that needs the two keys (go-live step 4).
- Reels carry their own copyright-free track by design (the owner's call).
  If a trending IG sound is ever wanted for a specific reel, add it in the
  Instagram app at post time — Instagram layers it over the baked-in audio
  or lets you mute the original.
- Costs per week (estimate): 6 copywriter calls + up to 6 top-up searches +
  vision screens ≈ a few dollars of API usage; Pexels is free.
