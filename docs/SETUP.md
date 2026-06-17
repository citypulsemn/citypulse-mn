# Setup Runbook

Zero to live, end to end. ~30–40 minutes. The app runs on sample data immediately, so you can do these in any order and nothing breaks until the relevant piece is wired.

## 0. Local app on sample data (2 min)

```bash
npm install
npm run dev      # http://localhost:3000
```

No env vars yet → the site serves bundled sample events; the map shows a "add a token" placeholder. Everything else works.

## 1. Database (10 min)

1. Create a **Supabase** (recommended) or **Neon** project.
2. Run [`db/schema.sql`](../db/schema.sql) in the SQL editor.
3. Copy the **pooled** connection string → this is `DATABASE_URL`.

Details and the connection-string location: [DATABASE.md](DATABASE.md).

## 2. Mapbox tokens (5 min)

At **account.mapbox.com → Tokens → Create a token**:
1. A **public** token for the browser → `NEXT_PUBLIC_MAPBOX_TOKEN`. Add Allowed URLs: `http://localhost:3000` and (later) your domain.
2. A second token for **server geocoding** → `MAPBOX_GEOCODING_TOKEN` (optional; falls back to the public one).

## 3. Anthropic key (2 min)

**console.anthropic.com → API Keys** → create one → `ANTHROPIC_API_KEY`.

## 4. Wire it locally (3 min)

```bash
cp .env.example .env.local
```

Fill in:

```
DATABASE_URL=postgres://…            # pooled
NEXT_PUBLIC_MAPBOX_TOKEN=pk.…
MAPBOX_GEOCODING_TOKEN=pk.…          # or reuse the public one
ANTHROPIC_API_KEY=sk-ant-…
```

## 5. First pipeline run (5 min)

```bash
npm run pipeline
```

This researches the next 14 days across all categories and writes **drafts** to the DB. Watch the logs for per-category counts.

## 6. Review & publish (5 min)

Open the **Supabase Table Editor** (or query Postgres). Filter `status = draft`, skim, and set the good ones to `published`. Restart `npm run dev` (or wait 5 min for ISR) and your real events appear on the calendar and map.

Verify quickly:

```bash
curl http://localhost:3000/api/events     # should return YOUR events, not the 30 samples
```

## 7. Automate the weekly run (5 min)

1. Push the repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add `DATABASE_URL`, `ANTHROPIC_API_KEY`, `MAPBOX_GEOCODING_TOKEN`.
3. The workflow [`.github/workflows/weekly-research.yml`](../.github/workflows/weekly-research.yml) now runs every Monday. Trigger it once manually from the **Actions** tab to confirm.

## 8. Deploy the website to Vercel (5 min)

The site is hosted on **Vercel** (native Next.js — keeps instant publishing, the live `/api/events` route, and real-time draft→publish). The domain **citypulsemn.com** (registered at GoDaddy) is pointed at it in the next step.

1. Import the GitHub repo at **vercel.com** (New Project → import).
2. **Project → Settings → Environment Variables** (Production + Preview): add `DATABASE_URL` and `NEXT_PUBLIC_MAPBOX_TOKEN`.
3. Deploy. You'll get a `*.vercel.app` URL — confirm the site loads there first.
4. After adding/changing `NEXT_PUBLIC_MAPBOX_TOKEN`, **redeploy** (it's build-time inlined).

## 9. Connect citypulsemn.com from GoDaddy (10 min + DNS propagation)

Keep the domain registered at GoDaddy and just point its DNS at Vercel.

1. In Vercel: **Project → Settings → Domains** → add `citypulsemn.com`. Vercel will show the **exact records to create** and mark the domain "Invalid Configuration" until they're live. Use the values Vercel shows you — they're tailored to your project and Vercel is rotating its IP ranges, so don't hardcode old values. (At time of writing the common defaults are an apex `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`; newer projects may be given `A @ → 216.150.1.1` and a `CNAME www → <project>.vercel-dns-NNN.com`.)
2. In GoDaddy: **My Products → the domain → DNS → Manage DNS**.
3. **First, clear conflicts.** If GoDaddy **domain forwarding** is on, turn it off — it injects extra locked apex `A` records (e.g. `15.197.225.128`, `3.33.251.168`) that cause a stuck "Invalid Configuration." Delete any existing `A @` and `CNAME www` rows that don't match Vercel's values.
4. **Add New Record** → the `A` record for `@` with Vercel's IP. **Add New Record** → the `CNAME` for `www` with Vercel's target. Save.
5. Back in Vercel → **Refresh**. When DNS propagates (minutes, occasionally up to 48h) it flips to **Valid Configuration** and Vercel **auto-provisions SSL**. Set the primary domain (apex or `www`) and let Vercel redirect the other.
6. **Add `https://citypulsemn.com` and `https://www.citypulsemn.com`** to the Mapbox public token's Allowed URLs, then redeploy so the map works on the live domain.

> Alternative: instead of A+CNAME records you can switch GoDaddy to **Vercel's nameservers** (Vercel manages all DNS). Simpler ongoing, but it moves *all* DNS for the domain to Vercel — only do this if citypulsemn.com isn't also handling email/other records you manage at GoDaddy.

## Verify checklist

- [ ] `db/schema.sql` applied; pooled `DATABASE_URL` copied
- [ ] Public Mapbox token created with `localhost:3000` + `citypulsemn.com` + `www.citypulsemn.com` allowed
- [ ] `.env.local` filled; `npm run dev` shows sample data, map renders
- [ ] `npm run pipeline` wrote drafts; logs show per-category counts
- [ ] Drafts reviewed and some set to `published`
- [ ] `curl /api/events` returns your events
- [ ] GitHub secrets set; weekly workflow run succeeds on manual trigger
- [ ] Vercel env vars set (Prod + Preview), redeployed; `*.vercel.app` URL loads
- [ ] GoDaddy forwarding off; `A @` + `CNAME www` match Vercel's values
- [ ] Vercel shows "Valid Configuration"; SSL issued; citypulsemn.com loads over HTTPS

## Tests & build (anytime)

```bash
npm test          # window logic + dedup key + price tiering (25 tests)
npm run build     # type-check + compile the site
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Site shows the 30 sample events | `DATABASE_URL` unset, or no `published` rows | Set the env var / publish some drafts; restart dev |
| `npm run pipeline` errors immediately | Missing `DATABASE_URL` or `ANTHROPIC_API_KEY` | Fill `.env.local` |
| Events found but none written | All rows failed geocoding | Check addresses; geocoder skips unmappable rows |
| Same event appears twice | Shouldn't happen — dedup is on `event_key` | If titles/venues differ wildly between runs, tighten the source/prompt |
| Map blank / 403 | Mapbox URL restriction | Add the current origin to the token's Allowed URLs |
| Map placeholder on Vercel | `NEXT_PUBLIC_MAPBOX_TOKEN` missing or not redeployed | Set it, then redeploy |
| Edited DB but site stale | 5-min ISR cache | Wait, or redeploy |
| Vercel stuck "Invalid Configuration" | GoDaddy forwarding injected locked `A` records | Turn off GoDaddy domain forwarding; delete stray `A @` rows |
| citypulsemn.com works but `www` doesn't (or vice versa) | Missing `CNAME www` or no primary/redirect set | Add the `www` CNAME; set the primary domain in Vercel |
| "Not secure" / no HTTPS on the domain | DNS not fully valid yet, so SSL hasn't issued | Wait for "Valid Configuration"; Vercel auto-issues the cert |
| Map 403 only on the live domain | Domain not in Mapbox Allowed URLs | Add `citypulsemn.com` + `www`, redeploy |
