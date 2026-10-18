# One pin per room

Shipped 18 October 2026. Fixes 45 live listings whose map pin pointed somewhere
the event was not, and stops the pipeline generating more.

## What was wrong

`geocode()` was called **once per event**, inside the pipeline loop, on whatever
address string that week's finding agent happened to supply
([run-pipeline.ts:169](../scripts/run-pipeline.ts:169)). Agents spell one address
several ways — `1308 SE 4th Street` / `1308 4th St SE`, `10 West Seventh Street`
/ `10 West 7th Street` — Mapbox answers differently for each, nothing cached the
result, and nothing reconciled them afterwards.

Measured 18 Oct 2026 over `status in ('published','draft')`, folded by `roomKey`:
**14 rooms holding 2–4 different pins across 95 listings.**

Two findings made the cause unmistakable:

- The **Minnesota Children's Museum** had two pins **8.2km apart** carrying the
  *same* address.
- `44.932149,-93.112696` was serving **both Grand Casino Arena and the Science
  Museum** — 1.67km and 1.58km from where each actually is. Mapbox had resolved
  "W Kellogg Blvd" to a street centroid and ignored the house number. Both
  venues are on that street.

This is the events-table version of a problem already fixed for places (74 of
567 place pins wrong, worst 10.5km — see the `places-coordinate-trust` memory).
The rule carried over from that audit is the one enforced here: **one geocoder
is a question, two agreeing is a finding.**

## The fix

A room's coordinate is decided **once** and stored in `venue_coords`, keyed by
`roomKey(venue)` so `Varsity Theater` and `Varsity Theater (Minneapolis)` are
one room. `lib/room-pin.ts` reads it before geocoding; both callers
(`run-pipeline.ts` and `lib/submission-publish.ts`) go through it.

```bash
npm run pins                                     # audit + resolve, writes nothing
npm run pins -- --apply --backup=before.json     # write venue_coords and sync
npm run pins -- --room="dakota jazz club"        # one room
npm run pins -- --room="dead end hayride" --address="28186 Kettle River Blvd N"
```

Two independent geocoders, both free and keyless: **OpenStreetMap Nominatim**
and **US Census TIGER**. A room is settled only when they land within 300m of
each other. Mapbox is deliberately not used — it is what produced the bad pins,
because it answers a house-numbered address with a street centroid rather than
failing.

### Three rules that cost something to learn

**Two queries to one geocoder is still one geocoder.** `agreeingPin` refuses a
pair from the same provider however close they land. Varsity Theater and Union
Rooftop both had two *Nominatim* answers agreeing to 0m; both happened to be
right, but the agreement was worth nothing. Each was re-confirmed against
Census (35m and 67m) before being used.

**Tighter agreement does not mean the address is right.** Duluth & Case
Recreation Center resolved cleanly, twice, **3m apart** — off `1030 Case Ave`,
an address no city page carries. St Paul's own site says **1020 Duluth St**,
where the two providers sat 97m apart and therefore *lost*. Both addresses in
our own listings were wrong. So `--address=` outranks a tighter match: the
operator settles *which* address, the geocoders settle *where* it is, and they
still have to agree to be believed.

**A pin somebody confirmed against the venue's own page is not overwritten** by
a later automatic run, even by two agreeing geocoders. That takes `--force`.
Otherwise the next `npm run pins` would quietly undo the hand-settled rooms with
the same wrong answer that needed settling.

### Verify stamps are not touched

A coordinate fix leaves `verified_at` alone. The verify pass is shown title,
venue, city and start (`VerifiableEvent`) — it never sees a coordinate, so
moving a pin cannot invalidate its stamp. Clearing 95 stamps would have pushed a
week of paid verification back into the queue to re-establish facts the change
never touched. `lib/corrections.ts` enforces the same rule for one-off
corrections via `affectsVerification`, and refuses `verified: true` on a change
the pass cannot see.

## What landed

| | |
|---|---|
| Rooms settled | **13** of 14 |
| Listings moved | **45** |
| Worst correction | Dead End Hayride, **18.1km** |
| Agreement range | 3m (Dead End Hayride, Crooners) to 207m (Allianz Field) |
| Verify stamps cleared | **0** — 523 of 548 upcoming listings still stamped |

Pins now in `venue_coords`:

| room | agreed within |
|---|---|
| dead end hayride · crooners supper club · dakota jazz club | 3–6m |
| union depot · roxys cabaret · minnesota childrens museum · varsity theater | 18–35m | 
| union rooftop · chs field · science museum of minnesota · grand casino arena · duluth case recreation center | 67–97m |
| allianz field | 207m |

## The one room left alone

**Downtown Anoka Main Street** — 4 listings, pins 25.5km apart. Not settled, and
deliberately so:

- Its listings give only cross-streets (`Main Street & 1st Avenue`,
  `Main Street & 5th Avenue`, `Main Street & State Street`, `Main Street`).
- Nominatim resolves Anoka's Main Street to **Lino Lakes**, 20km away, on every
  spelling tried.
- Census resolves the intersections correctly but they are genuinely 540m apart,
  because **a street is not a point** — this is a festival stretch, not a room.

Three of the four pins sit on Anoka's Main Street; one sits 25km off in the
direction of Lino Lakes. Rather than invent a venue point, the script reports it
and changes nothing. If you want it pinned, decide the point you mean and pass
it:

```bash
npm run pins -- --room="downtown anoka main street" --address="<street address>" --apply
```

## Why this cannot silently recur

`lib/room-pin.ts` asks the database once per **room** (memoised per process),
not once per event. A known room makes **no network call at all**, so the same
room cannot land on two pins however many ways its address is spelled —
demonstrated directly: with no `MAPBOX_GEOCODING_TOKEN` on this machine,
`geocode("1308 SE 4th Street", "Minneapolis")` returns `null` while
`roomPin("Varsity Theater", "1308 Fourth Street Southeast", "Minneapolis")`
returns the stored pin.

That also closes a second hole. A null geocode meant
`[pipeline] no geocode, skipping` — the listing was **dropped**. A known room
now resolves without a token, and an unknown room falls back to the venue NAME
when the address fails, which it did not before.

A pin this path establishes comes from one geocoder and records
`source = 'mapbox(single opinion)'`, so `npm run pins` can tell which rooms are
still a single opinion and upgrade them. Those are the only rows it will
overwrite without `--force`.

## Deploying

Schema is additive and idempotent. The `venue_coords` block is at the end of
`db/schema.sql`; it was already applied to production on 18 Oct, so a fresh
paste of the file is a no-op.

### Verify

```bash
npm run pins                     # expect: 1 room (downtown anoka), 4 listings
```

- [ ] The audit reports **only** Downtown Anoka, and reports it as not settled
      rather than silently skipping it
- [ ] `select count(*) from venue_coords` is 13, and every `agreed_m` is ≤ 300
- [ ] A listing at a fixed room shows the right place on its event page map
      (Grand Casino Arena is the one to look at — 18 listings moved)
- [ ] `select count(*) from events where status='published' and start_at >= now()
      and verified_at is not null` has not dropped
- [ ] `npm run pins --apply` (no bare `--`) exits 2 rather than writing

### Rollback

Per-room backups were written before each write
(`--backup=<path>.json`, the pattern from `scripts/dedupe-flagged.ts`). Restore
coordinates from those files by id. `venue_coords` can be dropped or emptied
without touching any listing — `room-pin.ts` falls through to a live geocode
when the table is unreadable (rule 1: the cache must not break what it speeds
up). Reverting the commit restores per-event geocoding, and the 45 corrected
listings keep their corrected pins.
