# Deploy Guide — Roadmap 5.2: Trending

**The first feature that consumes the feedback loop.** Yesterday you deployed the instrument (5.1); this is the first thing built on its data: a **Trending** surface ranked by what people in the Twin Cities are *actually* viewing, clicking, saving, and calendaring — not what an editor guesses.

**Code-only deploy. No database step, no new secrets** — it reads the `event_stats` table you already created.

---

## The math (documented in `docs/TRENDING.md`, every constant tunable)

`score = Σ ( weight × count × 0.5^(age_days / 3) )`

- **Intent ladder**: view = 1, save = 3, calendar add = 4, ticket click = 5. A ticket click means more than a view, and the ranking knows it.
- **Momentum, not lifetime totals**: engagement decays with a **3-day half-life** over a 7-day window. I verified this end to end with a simulated week of realistic stats: an event that peaked six days ago with the *largest lifetime totals in the dataset* ranks below a show with fresh momentum. Nothing coasts.
- **Eligibility**: published events you can still attend — upcoming, or a multi-day run still in progress. Ties break toward the sooner event.

## Cold-start honesty — the part designed for *this week*

Your stats table started filling yesterday. Three events with two views each is not "trending" — it's noise wearing a crown. So two guards, both tested:

1. **A score floor** (≈ one ticket click + three views in a day).
2. **All-or-nothing**: unless at least **4 events** clear the floor, trending renders **nothing, anywhere**. No sad half-empty strip, no placeholder.

This means: **you will deploy this and see no visible change.** That's correct behavior. As real traffic accumulates over the coming days, the surfaces switch on by themselves — and when they do, they'll be worth looking at.

## The three surfaces (all self-hiding until qualified)

1. **Homepage — "Trending now" strip** (top 6), below the calendar. Absent entirely until trending earns its place; the homepage today is byte-for-byte what it was.
2. **`/collections/trending`** — the full ranked list. Its empty state says plainly: "trending is measured, not curated."
3. **Collections index** — a "Trending Now" card appears in first position only when populated.

All three read one function carrying the resilience contract instituted after the 5.1 incident: any query failure logs and returns empty — **a trending strip can never take down the homepage**, by construction.

## Quality bar (all green)
- **397 tests (10 new)**: the intent ladder, the decay curve (half at 3 days, quarter at 6), the documented floor example, the all-or-nothing rule, tie-breaking, and the cap.
- End-to-end ranking scenario validated: fresh momentum beats stale spikes, noise never surfaces.
- Cold-start smoke on a running server: homepage unchanged (zero trending markup), `/collections/trending` renders its honest empty state, index shows no card.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Trending (roadmap 5.2)`) → push. Done.

## Verify

- [ ] Today: the homepage looks identical, and `/collections/trending` shows the "measured, not curated" note. That's the guards working.
- [ ] Watch **Admin → Stats** over the next days: when a handful of events show real view/click counts, the strip and the collection card appear on their own.
- [ ] When it lights up: the ordering should feel *right* — imminent events with fresh clicks on top. If it feels twitchy or stale, every constant (weights, half-life, floor, minimum) is named in `lib/trending.ts`, and I can retune with one change.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## What's next

**5.3 Personalized digest** — the saves people make (already being counted) become the signal for a digest that leads with what each subscriber actually cares about. Alternatively, **5.6 the ops digest** (coverage + verification flags + pipeline health in one weekly email to you) is a smaller bite with immediate operational value. And the **multi-day collapse** data op is still open — the State Fair remains quadrupled until we run it.
