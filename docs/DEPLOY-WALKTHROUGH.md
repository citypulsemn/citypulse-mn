# Deploy Walkthrough — the friendly, detailed version

This is the hold-your-hand version of [SETUP.md](SETUP.md). It assumes you've never deployed a website before and explains every concept and click. Nothing here is hard; there are just a lot of small pieces, and the trick is doing them in order. Take it one phase at a time — you can stop after any phase and pick up later.

By the end, **citypulsemn.com** will show live Twin Cities events, and a robot will refresh them every week while you sleep.

---

## First: the mental model

Right now the whole app lives in a folder on your computer. To put it online, the pieces move to a handful of free cloud services, each doing one job. Here's the cast of characters and what each one is *for*:

| The place | Plain-English job | Analogy |
|---|---|---|
| **GitHub** | Stores your code and its history | The filing cabinet for the app's source |
| **Vercel** | Runs the website and serves it to visitors | The building your shop operates out of |
| **Supabase** | Holds the events data (the database) | The stockroom where inventory lives |
| **GitHub Actions** | Runs the weekly research job automatically | The night-shift worker who restocks |
| **Anthropic** | The AI that researches events | The researcher the night-shift worker calls |
| **Mapbox** | Draws the map and turns addresses into pins | The cartographer |
| **GoDaddy** | Owns your domain name and its address book (DNS) | The post office that knows where "citypulsemn.com" points |

The single most important idea: **these services don't all talk to each other.** The flow is one direction. The night-shift worker (GitHub Actions) calls the researcher (Anthropic), writes findings into the stockroom (Supabase). The shop (Vercel) reads from the stockroom and shows customers. The post office (GoDaddy) just makes sure people typing your name end up at your shop. If you remember that picture, none of the rest is mysterious.

```
  Anthropic (AI researcher)
        ▲
        │ calls
  GitHub Actions ──writes──►  Supabase  ◄──reads──  Vercel  ◄──visitors
  (weekly robot)             (database)            (website)     ▲
                                                                 │ "where is citypulsemn.com?"
                                                            GoDaddy (DNS)
```

You'll set these up roughly in stockroom-first order, because the shop needs a stockroom to read from before it's worth opening the doors.

---

## What it costs

Almost everything here has a free tier that's plenty for this:

- **GitHub, Vercel, Supabase, Mapbox** — free at this scale. You will not enter a credit card to start.
- **GoDaddy** — you already paid for the domain (~$20/year). Nothing more.
- **Anthropic** — the *one* pay-as-you-go piece. The weekly research job calls the AI, and that costs money per run (think a few dollars per week, depending on how much searching it does). You add a small amount of credit and watch the usage in their console. This is the only ongoing usage bill.

So: one annual domain fee you've paid, and a small weekly AI cost. Everything else is free.

---

## What you'll need open

A web browser, the project folder (unzipped from `citypulse-mn.zip`), and a terminal. "Terminal" means: on **Mac**, the app called Terminal; on **Windows**, use **PowerShell** or the terminal inside the code editor below. You don't need to be a command-line wizard — you'll copy/paste a handful of commands.

Optional but recommended: install a code editor — **VS Code** (free, code.visualstudio.com). It gives you a file tree, a built-in terminal, and makes editing the one config file painless.

---

## Phase 0 — Put the code on your computer and run it once

**Why first:** before anything touches the cloud, prove the app runs locally. If it works on your machine, every later problem is a *connection* problem, not a *code* problem — which is far easier to reason about.

### 0.1 Install Node.js

Node.js is the engine that runs the app's code. (Your app is written in JavaScript/TypeScript; Node is what executes it.)

1. Go to **nodejs.org**.
2. Download the **LTS** version (it'll say something like "22.x.x LTS"). LTS = "long-term support" = the stable one.
3. Install it (accept the defaults). This also installs **npm**, the tool that downloads the app's building blocks.

Verify it worked — open your terminal and type:

```bash
node -v
npm -v
```

✅ **You'll know it worked when** each prints a version number (e.g. `v22.11.0` and `10.9.0`). If you get "command not found," close and reopen the terminal, or restart your computer so it picks up the new install.

### 0.2 Open the project and install its building blocks

1. Unzip `citypulse-mn.zip` somewhere memorable (e.g. your Documents folder).
2. Open that folder in VS Code (**File → Open Folder**), then open its built-in terminal (**Terminal → New Terminal**). The terminal is now "inside" the project folder, which is what you want.
3. Run:

```bash
npm install
```

This reads the project's shopping list (`package.json`) and downloads everything it needs into a `node_modules` folder. It'll take a minute and print a lot — that's normal.

✅ **You'll know it worked when** it finishes with something like "added N packages" and no red `ERR!` lines. (A note about "vulnerabilities" if you see it: this project is built to report **0**, so if it says 0, you're perfect.)

### 0.3 Run the site

```bash
npm run dev
```

✅ **You'll know it worked when** it prints `Local: http://localhost:3000`. Open that address in your browser. **You'll see City Pulse MN running on sample data** — the calendar and filters work; the map shows a "add a token" placeholder for now. That placeholder is expected; we add the map key in Phase 2.

`localhost:3000` means "this computer, door number 3000" — it's the app running privately on your machine, not on the internet yet. Leave it running; to stop it later, click the terminal and press **Ctrl+C**.

> 🧠 **New terms you just met:** *Node.js* (the engine), *npm* (the installer), *localhost* (your own machine), *dev server* (`npm run dev`, a live preview that reloads as you change things).

---

## Phase 1 — Stand up the database (Supabase)

**Why:** this is the stockroom. The website reads events from it; the weekly robot writes events to it. Until it exists, there's nowhere for real events to live.

### 1.1 Create the project

1. Go to **supabase.com** → **Start your project** → sign in (signing in **with GitHub** is easiest and sets up Phase 5 nicely — make a GitHub account now if you don't have one).
2. **New project.** Give it a name (`citypulse-mn`), and it'll ask you to **set a database password** — generate a strong one and **save it somewhere safe** (a password manager). You'll need it in a moment and it's annoying to reset.
3. Pick a **region** close to Minnesota (e.g. an East or Central US region) so the database is physically near your users.
4. Click create and wait ~2 minutes while it provisions.

> 🧠 **What's a database?** A structured place to store rows of data — here, one row per event, with columns for title, venue, date, coordinates, etc. Supabase gives you a real **Postgres** database (an industrial-strength, decades-proven kind) plus a friendly web UI to look at it.

### 1.2 Create the events table

The project ships with the exact blueprint for the table. You just run it.

1. In Supabase's left sidebar, open the **SQL Editor**.
2. Click **New query**.
3. In your project folder, open `db/schema.sql`, copy **all** of it, and paste it into the query box.
4. Click **Run**.

✅ **You'll know it worked when** it says "Success. No rows returned." That's correct — you just *created* the table, you didn't ask for any data back. You can confirm by opening **Table Editor** in the sidebar; you'll see an empty `events` table with all its columns.

> 🧠 **What's SQL?** The language for talking to databases. `schema.sql` is a script that says "make a table called events with these columns and rules." You won't need to write SQL — the app does it for you — but running this one script is how the table gets born.

### 1.3 Get the connection string (this becomes `DATABASE_URL`)

The app finds your database through one long line of text called a **connection string** — it bundles the address, username, and password together.

1. Go to **Project Settings** (the gear icon) → **Database**.
2. Find **Connection string** → choose the **Transaction** / **pooled** option → copy the **URI**. It looks like:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres`
3. Replace `[YOUR-PASSWORD]` with the database password you saved in 1.1.

Keep this somewhere handy for Phase 3. **This is a secret** — it's the key to your data. Don't paste it into emails, screenshots, or your code.

> 🧠 **Why "pooled"?** It's the connection type that behaves well when lots of little serverless functions connect at once — which is exactly how Vercel and the pipeline work. Just pick the pooled one; the app is configured for it.

---

## Phase 2 — Get your service keys (Mapbox + Anthropic)

**Why:** the map and the AI researcher are external services. They each hand you a **key** (a long password) that proves your app is allowed to use them.

### 2.1 Mapbox — two tokens, two jobs

Mapbox does two different things for us, so you'll make two tokens with different security settings. (A "token" here is the same idea as a key.)

**Token A — the public map token (for the browser):**
1. Sign up at **mapbox.com** → go to your **Account → Tokens**.
2. Click **Create a token**. Name it `citypulse-web`.
3. Leave the default **public scopes** checked (`styles:read`, `fonts:read` — these let it draw maps).
4. Under **URL restrictions** (sometimes "Allowed URLs"), add these so the token only works on your sites and can't be abused if someone copies it:
   - `http://localhost:3000`
   - `https://citypulsemn.com`
   - `https://www.citypulsemn.com`
5. Create it and copy the token — it starts with `pk.`. **This becomes `NEXT_PUBLIC_MAPBOX_TOKEN`.**

**Token B — the geocoding token (for the server):**
The weekly robot turns street addresses into map coordinates ("geocoding"). It runs on a server, not in a browser, so URL restrictions would *block* it. So make a second token **without** URL restrictions:
1. **Create a token** again, name it `citypulse-geocoding`, default scopes, **no URL restrictions**.
2. Copy it (`pk.…`). **This becomes `MAPBOX_GEOCODING_TOKEN`.**

> 🧠 **Why two?** The browser token is exposed to anyone who views your site (that's unavoidable for web maps), so we lock it to your domains. The geocoding token is never shown publicly but must work without a domain, so it can't carry that restriction. Different jobs, different safety settings. (If you want to keep it simple at first, you can reuse Token A for geocoding by leaving `MAPBOX_GEOCODING_TOKEN` blank — the app falls back to the public one. Two tokens is just the cleaner, safer setup.)

### 2.2 Anthropic — the AI researcher key

1. Go to **console.anthropic.com** → sign up.
2. Go to **Billing** and add a small amount of credit (this is the pay-as-you-go piece from the cost section). Start small — you can add more later.
3. Go to **API Keys** → **Create Key** → name it `citypulse-pipeline` → copy it. It starts with `sk-ant-`. **This becomes `ANTHROPIC_API_KEY`.**

✅ **After Phase 2 you should have four secrets written down:** `DATABASE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `MAPBOX_GEOCODING_TOKEN`, `ANTHROPIC_API_KEY`.

> 🧠 **What's an API key?** A password that lets *your* app use *their* service, and lets them track usage to the right account. Treat every key like a password.

---

## Phase 3 — Wire the keys into your local app

**Why:** your app reads its secrets from a file called `.env.local` that lives only on your computer and is never uploaded. This is how you keep passwords out of your code.

1. In the project folder, find the file `.env.example`. Make a copy named exactly **`.env.local`**. (In VS Code: right-click `.env.example` → Copy, then Paste and rename. In the terminal: `cp .env.example .env.local`.)
2. Open `.env.local` and fill in the values you collected, each after its `=` sign with no spaces and no quotes:

```
DATABASE_URL=postgresql://postgres.xxxx:yourpassword@aws-0-...pooler.supabase.com:6543/postgres
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_web_token
MAPBOX_GEOCODING_TOKEN=pk.your_geocoding_token
ANTHROPIC_API_KEY=sk-ant-your_key
```

3. Save the file.
4. Back in the terminal, stop the dev server if it's running (**Ctrl+C**) and start it again so it picks up the new settings:

```bash
npm run dev
```

✅ **You'll know it worked when** you reload `localhost:3000` and **the map now renders** (real streets, not the placeholder). You'll still see sample events — that's correct, because the database is empty until Phase 4 fills it.

> 🧠 **What are environment variables?** Settings you feed an app from *outside* the code — secrets, mostly — so the same code can run on your laptop, on Vercel, and in the robot, each with its own values. `.env.local` is just the laptop's copy. The `NEXT_PUBLIC_` prefix is a deliberate signal that a value is safe to send to the browser (like the map token); values without it (like `DATABASE_URL`) never leave the server.

---

## Phase 4 — Fill the stockroom: your first research run

**Why:** time to replace the sample data with real Twin Cities events, and to see the weekly robot's job run once, by hand, so you understand what it does.

1. With `.env.local` filled in, run:

```bash
npm run pipeline
```

2. Watch the terminal. It works through the horizon bands (near/mid/far) and, within each, the categories (music, sports, family, arts, food, weird, festival), reporting how many events it wrote, e.g. `near/music: upserted 6`. The whole run takes a few minutes — this is the AI doing real web research, so it's not instant.

✅ **You'll know it worked when** it ends with a summary like `done — upserted N, archived 0`.

3. Now go look at what it found: Supabase → **Table Editor** → `events`. The rows have **status = `published`** — they're **already live** (events auto-publish; there's no approval step). 

4. **Hiding something (optional).** If an event isn't a fit, click its `status` cell and change `published` to `draft`. It drops off the site immediately, and — importantly — the weekly robot won't bring it back, because your choice sticks. Change it back to `published` any time. (There are ready-made snippets in `db/moderate-events.sql`.)

5. Reload `localhost:3000` (the site caches for ~5 minutes, so either wait or restart `npm run dev`). **Your real events now appear** on the calendar and map.

> 🧠 **Auto-publish vs. review.** Events go live on their own, and you curate by *exception* — hiding the occasional miss rather than approving every hit. If you'd ever rather approve each one first, that's a one-line switch (`NEW_EVENT_STATUS` in `lib/pipeline-config.ts` → `"draft"`), and new events would arrive hidden for you to publish by hand.

---

## Phase 5 — Put the code on GitHub

**Why:** Vercel (the host) and GitHub Actions (the robot) both work by reading your code from GitHub. So the code needs a home there. GitHub also keeps a full history, so you can never truly break things.

The friendliest way without learning Git commands:

1. Install **GitHub Desktop** (desktop.github.com) and sign in with your GitHub account.
2. **File → Add Local Repository** → choose your project folder. It'll say the folder isn't a repository yet and offer to **create one** — do that.
3. It'll show all the project files as ready to commit. Add a short summary like "Initial commit" and click **Commit to main**. (A "commit" is a saved snapshot.)
4. Click **Publish repository**. **Uncheck "keep this code private"** only if you want it public; private is fine and recommended. Publish.

✅ **You'll know it worked when** the repo appears at github.com under your account with all the files.

> 🛡️ **Safety note:** your secrets are *not* uploaded — the project includes a `.gitignore` that deliberately excludes `.env.local`. Double-check that `.env.local` is **not** in the file list GitHub Desktop shows. (It shouldn't be.) Secrets get added to the cloud services directly, in the next phases, never through code.

> 🧠 **What's Git/GitHub?** Git is a system that tracks every change to your code over time. GitHub is a website that hosts Git projects and lets other services (Vercel, Actions) read them. A *repository* ("repo") is just your project under Git's tracking.

---

## Phase 6 — Open the shop: deploy to Vercel

**Why:** this is what actually puts the website on the internet at a public address.

1. Go to **vercel.com** → sign in **with GitHub** (so it can see your repo).
2. **Add New → Project** → find your `citypulse-mn` repo → **Import**.
3. Vercel auto-detects it's a Next.js app — you don't need to change build settings.
4. Before clicking deploy, expand **Environment Variables** and add the two the *website* needs (the pipeline keys are added elsewhere, in Phase 8):
   - `DATABASE_URL` → your Supabase connection string
   - `NEXT_PUBLIC_MAPBOX_TOKEN` → your `pk.` web token
   
   Add each for **Production and Preview** environments (there's usually a checkbox set; the default covering both is fine).
5. Click **Deploy** and wait ~1–2 minutes.

✅ **You'll know it worked when** Vercel shows confetti and a link like `citypulse-mn-xxxx.vercel.app`. Open it — **your site is now live on the internet** at that temporary address, showing your published events. Send it to your phone; it works from anywhere.

> 🧠 **What just happened?** Vercel pulled your code from GitHub, "built" it (compiled it into an optimized website), and started serving it. From now on, **every time you push a change to GitHub, Vercel automatically rebuilds and redeploys** — no manual step. That temporary `.vercel.app` URL is real and permanent; the next phase just puts your nice domain name in front of it.

> ⚠️ One rule to remember: `NEXT_PUBLIC_` variables get baked in **at build time**. If you ever change the map token in Vercel, you must **redeploy** for it to take effect (Vercel → Deployments → ⋯ → Redeploy).

---

## Phase 7 — Point citypulsemn.com at the shop (GoDaddy DNS)

**Why:** right now your site answers at `…vercel.app`. This phase makes `citypulsemn.com` lead there instead. You keep the domain at GoDaddy; you just edit its **DNS** — the address book that tells the internet where your name points.

> 🧠 **DNS in one breath:** when someone types `citypulsemn.com`, their browser asks the internet's address book "what's the address for this name?" DNS records are the entries in that book. An **A record** maps your bare domain to a numeric address (an IP). A **CNAME record** maps a subdomain like `www` to *another name*. You'll add one of each, using the exact values Vercel gives you.

### 7.1 Tell Vercel the domain

1. In Vercel: **your project → Settings → Domains**.
2. Type `citypulsemn.com` and **Add**.
3. Vercel will display **the exact DNS records to create** and mark the domain **"Invalid Configuration"** (expected — you haven't added the records yet). **Keep this tab open**; you'll copy its values. They're specific to your project, and Vercel has been rotating its addresses, so use *their* numbers, not any you read elsewhere. (For reference, they're commonly an `A` record value of `76.76.21.21` or the newer `216.150.1.1`, and a `www` CNAME pointing to `cname.vercel-dns.com` or a `…vercel-dns-0NN.com` address — but trust the dashboard over this sentence.)

### 7.2 Clear GoDaddy's conflicting records (the #1 gotcha)

A fresh GoDaddy domain often has **parking/forwarding** turned on, which silently adds locked `A` records that will fight Vercel and keep you stuck on "Invalid Configuration." Clear those first:

1. Go to **GoDaddy → your account → My Products** → find the domain → **DNS** (or **Manage DNS**).
2. If there's a **Forwarding** section with an entry, **remove it** (Domain Settings → Forwarding → delete). This also clears the hidden parked records it created.
3. In the **DNS Records** list, delete any existing **`A` record with name `@`** and any default **`CNAME` `www`** that don't match Vercel's values. (Leave unrelated records like `MX` for email alone.)

### 7.3 Add Vercel's two records

Still in GoDaddy's DNS records:

1. **Add New Record → Type: A.** Name: `@` (this means the bare domain). Value: the IP Vercel showed you. TTL: leave default (1 hour). Save.
2. **Add New Record → Type: CNAME.** Name: `www`. Value: the target Vercel showed you (e.g. `cname.vercel-dns.com`). Save.

### 7.4 Wait, verify, and let SSL turn on

1. Back in the Vercel Domains tab, click **Refresh**. 
2. DNS changes spread across the internet over **minutes, occasionally up to 48 hours** (usually fast). When it catches up, Vercel flips to **"Valid Configuration."**
3. Vercel then **automatically issues an SSL certificate** — that's what makes the padlock and `https://` work. You do nothing for this; just wait for it to say the certificate is issued.
4. In Vercel's Domains screen, pick whether `citypulsemn.com` or `www.citypulsemn.com` is **primary**; Vercel auto-redirects the other so both work.

✅ **You'll know it worked when** typing **https://citypulsemn.com** loads your site with a padlock. 🎉

> 🧠 **Why the wait?** DNS is cached all over the world for speed, so a change isn't instant everywhere. "Propagation" is just the old cached answers expiring. Patience is the whole skill here.

> 🗺️ **One more:** confirm `citypulsemn.com` and `www.citypulsemn.com` are in your Mapbox **web token's** Allowed URLs (Phase 2.1). If the map loads on `.vercel.app` but 403s on your domain, this is why — add them and redeploy.

---

## Phase 8 — Hire the night shift: automate the weekly run

**Why:** so events refresh on their own every week instead of you running `npm run pipeline` by hand. The project already contains the schedule; you just give the robot its own copies of the secrets.

> 🧠 **Why separate secrets?** The robot (GitHub Actions) runs in the cloud, not on your laptop, so it can't see your `.env.local`. You hand GitHub the secrets it needs, stored encrypted. They're used only when the job runs and are never visible in logs.

1. Go to your repo on **github.com → Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add these three, one at a time (name on top, value below):
   - `DATABASE_URL`
   - `ANTHROPIC_API_KEY`
   - `MAPBOX_GEOCODING_TOKEN`
3. Now test it by hand: go to the **Actions** tab → choose **"Weekly Event Research"** in the left list → **Run workflow** → confirm. 
4. Watch it run (click into the run to see live logs — the same per-category output you saw locally).

✅ **You'll know it worked when** the run finishes green and new `published` rows appear in your Supabase Table Editor.

From now on it runs **every Monday at 06:00 UTC** automatically. Events publish themselves — your only recurring job is the occasional hide when something isn't a fit.

> 🧠 **What's a "workflow"?** A recipe (the file `.github/workflows/weekly-research.yml`) that tells GitHub Actions what to do and when. Yours says "every Monday, install the app and run the pipeline." `workflow_dispatch` is the line that also lets you run it manually, which you just did.

---

## Your weekly rhythm, from here on

Once everything above is done, running City Pulse is light:

1. **Monday** — the robot researches the horizon (weeks to months out) and writes fresh events into Supabase, **auto-published**. They're live within ~5 minutes; you don't have to do anything.
2. **Whenever you like** — if something isn't a fit, open Supabase Table Editor and flip that event to **`draft`** to hide it. That's curating by exception, not approving every event.
3. **Changing the site itself** (design, copy, features) — edit the code, commit/push in GitHub Desktop, and Vercel redeploys automatically in a minute or two.

That's the whole operation. Database and robot run themselves; you step in only to hide the occasional miss.

---

## When something looks wrong

| What you see | What it usually means | What to do |
|---|---|---|
| Site shows the old sample events | No rows yet (pipeline hasn't run), or `DATABASE_URL` missing on Vercel | Run the pipeline (events auto-publish); confirm the Vercel env var; redeploy |
| Map is a gray placeholder | Map token missing or (on Vercel) changed without a redeploy | Set `NEXT_PUBLIC_MAPBOX_TOKEN`; redeploy |
| Map works on `.vercel.app` but 403s on your domain | Domain not in the Mapbox token's Allowed URLs | Add `citypulsemn.com` + `www`; redeploy |
| Vercel domain stuck on "Invalid Configuration" | GoDaddy forwarding/parked records, or wrong values | Turn off forwarding; delete stray `A @`; match Vercel's values exactly |
| `www` works but bare domain doesn't (or vice versa) | One record missing, or no primary set | Add the missing A/CNAME; set the primary domain in Vercel |
| No padlock / "Not secure" | DNS not fully valid yet, so SSL hasn't issued | Wait for "Valid Configuration"; the cert auto-issues |
| `npm run pipeline` quits immediately | A secret is missing | Check `.env.local` has `DATABASE_URL` and `ANTHROPIC_API_KEY` |
| Pipeline runs but writes nothing | Events found but failed geocoding | Usually addresses; the geocoder skips anything it can't place |
| You edited the DB but the site looks stale | The 5-minute cache | Wait a few minutes, or redeploy |

If you're ever unsure which piece is misbehaving, walk the flow in order: does it work locally (`npm run dev`)? Does the DB have published rows? Does the `.vercel.app` URL work? Is the domain "Valid" in Vercel? The first "no" is your culprit.

---

## Mini-glossary

- **Node.js / npm** — the engine that runs the app, and the tool that installs its parts.
- **localhost:3000** — the app running privately on your own computer.
- **Repository (repo)** — your project stored on GitHub with full change history.
- **Deploy** — publish the app so the public internet can reach it.
- **Build** — compile the code into the optimized website that gets served.
- **Environment variable** — a setting/secret fed to the app from outside the code (e.g. `DATABASE_URL`).
- **Connection string** — one line containing your database's address + credentials.
- **API key / token** — a password that lets your app use a service (Mapbox, Anthropic).
- **Database / Postgres** — the structured store of your events; Supabase hosts it.
- **Published vs draft** — `published` is live (the default for new events); set an event to `draft` to hide it from the site.
- **DNS** — the internet's address book that maps names to servers.
- **A record / CNAME** — DNS entries mapping your domain (and `www`) to where the site lives.
- **Propagation** — the delay while a DNS change spreads worldwide.
- **SSL / HTTPS** — the padlock; encrypted, trusted connection. Vercel sets it up for you.
- **ISR / cache** — why DB edits take a few minutes to show; the site serves a recent snapshot for speed.
- **Workflow (GitHub Actions)** — the scheduled recipe that runs your weekly research.

---

You don't have to do this in one sitting. A sane order: Phase 0 today (prove it runs), Phases 1–4 when you've got an hour (real data flowing), Phases 5–8 when you're ready to go public. Each phase ends at a stable, working place.
