# Deploy Guide — Roadmap 2.2: The Ongoing Strip (+ 2.3: ENGINEERING.md)

**A home for the long runs.** The calendar deliberately shows runs longer than 14 days only at their start — right for the grid, but it made a three-week exhibition nearly invisible mid-run. Now the long runs get a persistent surface: an **Ongoing strip on the homepage** and an evergreen **`/ongoing` page**, both sorted ending-soonest — because "last chance" is the editorial angle. A show closing Sunday matters more than one running through November.

**Code-only deploy. No database step, no new secrets.** (And per the roadmap, 2.3 rides along: the incident-derived engineering rules are now written down in `docs/ENGINEERING.md`.)

---

## The definition (pure, golden-tested)

An event is *ongoing* when it **started before today** (something starting today belongs to today's calendar, not the shelf), is **still running by TRUE span** — `spanEnd`, never the calendar-capped expansion; the 17-day-fair bug from the weekend page is encoded here as a regression test — and the **run exceeds 3 days** (a Fri–Sun run is a weekend thing). A 9 PM show ending at 1 AM is a late night, not a two-day run — the existing late-night rule applies.

Cards carry a closing eyebrow: **"Through Sep 7"**, or **"Last day today"** when the urgency is real. Cap 12; the homepage strip self-hides below 3 qualifying runs — the honesty rule: no sad placeholders.

Verified on realistic post-collapse data, and the output reads exactly as designed:

```
Last day today   Suzanne Jackson: What Is Love (Exhibition)
Through Sep 7    Minnesota State Fair
Through Sep 22   Como Summer Flower Show
Through Oct 4    Minnesota Renaissance Festival
```

(Once you've run the 1.1 collapse, this is roughly what late August will actually look like — the strip is the collapse's payoff surface.)

## Quality bar (all green)
- **543 tests (13 new)** — the boundary days (ends today in / ended yesterday out / starts today out), the >3-day floor, the true-span regression, late-night exclusion, ending-soonest ordering, the cap, draft exclusion, labels.
- Smoke: `/ongoing` renders with an honest empty state on past-dated sample data; the homepage strip correctly self-hides below minimum; footer link and sitemap entry verified.
- `/ongoing` prerenders with a single query — the allowed pattern per ENGINEERING.md rule 2.
- tsc clean · build clean · 0 vulnerabilities. (One packaging hiccup mid-build — an interrupted call produced a stale zip; caught by checking the archive's own contents, repackaged, re-verified.)

## 2.3 — the rules, written down

`docs/ENGINEERING.md` now holds the seven standing rules with their origin incidents: the never-break contract (the admin-stats 500) · no build-time DB prerenders (the Vercel stampede) · the container's permanent blind spots · verify the axis the user reported (the venue-map lesson) · true spans, not capped expansions (the invisible fair) · honest emptiness · smoke conventions. Tribal knowledge is now repo knowledge.

---

## Deploy

Unzip `citypulse-mn.zip` over the repo, commit (`Ongoing strip + engineering rules (roadmap 2.2/2.3)`) → push.

## Verify

- [ ] `citypulsemn.com/ongoing` — long runs sorted by closing date, "Through …" eyebrows.
- [ ] Homepage: if ≥3 long runs qualify (post-collapse, late summer almost certainly will), the **Ongoing** strip appears under Trending; if not, nothing appears and nothing looks broken.
- [ ] During the State Fair: the Fair shows "Through Sep 7" — then watch it climb the strip as closing day nears. That's the ending-soonest design working.
- [ ] Footer shows **Ongoing** next to This Weekend; `/sitemap.xml` includes it.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## The board

**Phase 2 — the cockpit — is complete:** 2.1 ops digest ✓ · 2.2 ongoing ✓ · 2.3 rules ✓. Phase 1 remainders are yours (run the 1.1 SQL, the GSC clicks, bio link, paste one real IG card). Next: **Phase 3 — earning the index** — starting with **3.2 content depth** (your editorial paragraphs on the money pages + the "More at this venue" strip), the cheapest real ranking signal available.
