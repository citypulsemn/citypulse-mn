# Connectors & Tools

Every external service the system touches, what it's for, the env var it uses, and where to get the key.

## At a glance

| Service | Role | Env var(s) | Side | Cost to start |
|---|---|---|---|---|
| **Supabase** *or* **Neon** | Postgres database | `DATABASE_URL` | both | Free tier |
| **Mapbox** | Map tiles (browser) + geocoding (server) | `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_GEOCODING_TOKEN` | both | Free tier |
| **Anthropic API** | Research agents (Claude + web search) | `ANTHROPIC_API_KEY` | pipeline | Usage-based |
| **GitHub Actions** | Weekly cron that runs the pipeline | repo secrets (below) | pipeline | Free |
| **Vercel** | Hosts the website | env vars in dashboard | website | Free tier |
| **GoDaddy** | Domain registrar + DNS for citypulsemn.com | DNS records (no env var) | website | Domain cost |
| **Trigger.dev** *(optional)* | Durable pipeline alternative | `TRIGGER_SECRET_KEY` | pipeline | Free tier |

"Side" = whether it serves the **website**, the **pipeline**, or both.

## Database — Supabase or Neon

Both are standard Postgres; switch by changing `DATABASE_URL`. Default recommendation: **Supabase** (its Table Editor doubles as your draft-review UI). **Neon** if you want lean pure-Postgres with scale-to-zero. See [DATABASE.md](DATABASE.md) for provisioning and the connection-string location.

- Used by the **website** (`lib/db.ts` → `getEvents()`, read-only) and the **pipeline** (`lib/upsert.ts`, writes).
- Use the **pooled** connection string.

## Mapbox — two tokens, two jobs

Mapbox does double duty, so use two tokens with least privilege:

- **`NEXT_PUBLIC_MAPBOX_TOKEN`** — *browser*, public (`pk.*`), restricted to your domain (+ `http://localhost:3000` for dev). Draws the map. Scopes: `styles:read`, `fonts:read`.
- **`MAPBOX_GEOCODING_TOKEN`** — *server*, used by `lib/geocode.ts` during the pipeline to turn addresses into coordinates. Keep it server-side. Optional — if unset, geocoding falls back to the public token.

Get both at **account.mapbox.com → Tokens → Create a token**. Don't reuse the account's default token (it can't take URL restrictions).

## Anthropic API — the research agents

- **`ANTHROPIC_API_KEY`** powers the per-category agents (`lib/agents/research-agent.ts`), which call **Claude Sonnet** with the built-in **`web_search`** tool. Pipeline-only; never exposed to the browser.
- Get it at **console.anthropic.com → API Keys**.
- Model and search breadth are configurable in `research-agent.ts`.

## GitHub Actions — the scheduler

Runs `.github/workflows/weekly-research.yml` on a weekly cron. Add these as **repo secrets** (Settings → Secrets and variables → Actions):

- `DATABASE_URL`
- `ANTHROPIC_API_KEY`
- `MAPBOX_GEOCODING_TOKEN`

No SDK or service to install — the workflow just runs `npm run pipeline`.

## Vercel — the website host

Deploys `app/` + `components/`. Set environment variables in **Project → Settings → Environment Variables** (Production + Preview):

- `DATABASE_URL` (server-side; read-only use by the site)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (browser)

`NEXT_PUBLIC_*` vars are baked in at build time → **redeploy after changing them**. The non-public `DATABASE_URL` is read at runtime.

## GoDaddy — domain & DNS

The app lives at **citypulsemn.com**, registered at GoDaddy. The domain stays at GoDaddy; only its DNS points at Vercel:

- Add `citypulsemn.com` in **Vercel → Project → Settings → Domains**, then create the `A @` and `CNAME www` records it shows you in **GoDaddy → DNS → Manage DNS**.
- Turn **off** GoDaddy domain forwarding first — it injects locked apex `A` records that block validation.
- Vercel auto-provisions SSL once DNS validates. No env var; this is pure DNS config.
- Add `citypulsemn.com` and `www.citypulsemn.com` to the **Mapbox** public token's Allowed URLs.

Step-by-step in [SETUP.md](SETUP.md) §9.

## Trigger.dev — optional pipeline runner

Only if you adopt the durable alternative in `examples/trigger-alternative/`. Needs `TRIGGER_SECRET_KEY` and `npm i @trigger.dev/sdk`. See [PIPELINE.md](PIPELINE.md) for when it's worth it.

## Full env var map

| Variable | Website | Pipeline | Secret? |
|---|---|---|---|
| `DATABASE_URL` | ✓ (read) | ✓ (write) | yes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✓ | — | no (public, restrict by URL) |
| `MAPBOX_GEOCODING_TOKEN` | — | ✓ | yes |
| `ANTHROPIC_API_KEY` | — | ✓ | yes |
| `TRIGGER_SECRET_KEY` | — | optional | yes |

See [`.env.example`](../.env.example) for the local template.
