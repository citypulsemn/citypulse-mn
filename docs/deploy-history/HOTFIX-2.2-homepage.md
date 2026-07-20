# Hotfix — 2.2 homepage server-side exception

## What broke
After deploying 2.2, the homepage threw a server-side exception. Cause: `lib/subscribe-actions.ts` had the `"use server"` directive **and** exported a non-function value (`initialSubscribeState`) plus a type. A `"use server"` module is only allowed to export async server actions. When the client subscribe form imported that value, the bundler resolved it to a broken server-reference instead of the plain object, which throws during the server render of any page that shows the footer form — including the homepage.

It slipped through because a local production build still prerenders the page without erroring; the fault only surfaces at runtime on Vercel.

## The fix
- Moved the `SubscribeState` type and `initialSubscribeState` value into a new plain module `lib/subscribe-types.ts` (no directive).
- `lib/subscribe-actions.ts` now exports **only** the async `subscribeAction`.
- The form imports the initial state from `lib/subscribe-types.ts`.

No behavior change to the feature — just correct module boundaries.

Verified: clean typecheck, 145 tests pass, clean production build, homepage and event pages render 200 with the form, no runtime errors logged.

## Deploy (code-only, ~2 min)
1. Unzip the new `citypulse-mn.zip`, copy over your project (**Replace**).
2. GitHub Desktop → commit (`Hotfix: subscribe action module boundary`) → **Push origin**.
3. Vercel redeploys. The homepage should load normally again.

Changed files: `lib/subscribe-actions.ts`, `components/SubscribeForm.tsx`, and new `lib/subscribe-types.ts`.

## Also make sure the 2.2 SQL ran
The homepage fix above is independent of the database. But for the subscribe **feature** itself to work (storing signups, the admin Stats count, and the CSV export), the `subscribers` table must exist. If you haven't yet: Supabase → SQL Editor → paste the updated `db/schema.sql` → Run (idempotent). Until then, the form would error on submit and `/admin/stats` would fail — but the homepage will load fine with just the code fix.

## If the homepage error somehow persists
Grab the exact error so we can pinpoint it: Vercel dashboard → your project → the latest **Deployment** → **Runtime Logs** (or **Functions**), reproduce by loading the homepage, and copy the red error line (it'll be more specific than the `Digest` code the browser shows). Paste it here and I'll zero in.
