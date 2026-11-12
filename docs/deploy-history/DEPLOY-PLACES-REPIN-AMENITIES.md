# Deploy — 148 Places pins moved onto the beach, pad, hill or building they mark

*12 Nov 2026. Registry data (`lib/places.ts`) and one test (`lib/__tests__/places.test.ts`). No schema, no
env, no new code paths.*

## What shipped

**148 pins moved** to the points measured on 9 Nov against the Metropolitan Council April 2025 aerial photo
(`docs/PLACES-PIN-AUDIT-NOV-2026.md`). These are the high- and medium-confidence rows of that report, all
of them. By kind:

| Kind | Moved |
|---|---:|
| dog parks | 40 |
| beaches | 39 |
| splash pads | 20 |
| parks | 19 |
| disc-golf courses | 14 |
| nature centers | 12 |
| sledding hills | 4 |

The old pins were 157 m to 18 km off, with a median of about 900 m, and 67 were more than a kilometre off.
Each moved row now has a one-line comment with its old pin, the distance and the confidence, in the same
format as the golf and pool re-pins.

**The decimals guard now counts significant decimals.** The old rule counted *written* decimals, so
`45.3350, -93.2900` (a guess with zeros typed on) passed. 85 of the 86 such pins that were measured were
more than 150 m off. The new rule takes the better axis of the pair, so a real read that happens to end in
a zero (`44.9520, -93.2347`) still passes.

`KNOWN_ROUND` now lists the **86 pins still padded today**: mostly museums, rinks, orchards, gyms, gardens
and the low-confidence or not-found rows from the audit. The list only shrinks. A new padded pin fails the
test, and so does a listed pin that has been re-read but left on the list.

## Why it was built this way

- **Only high and medium confidence.** For these, the proposed point was checked by eye on a zoom crop with
  the amenity under it. The 43 low-confidence rows (sledding hills with no snow, disc-golf courses with no
  visible tees, unfenced dog areas) are unchanged and wait for a pass with each park's own map.
- **The four `park` pins the report called optional moved too.** That's William O'Brien's ranger station,
  Phalen, Como and Boom Island. They were part of the 148 Taren approved, and each now points at the
  park's main arrival point rather than a spot inside the park.
- **A shrink-only list, not a strict rule.** A strict rule would fail on 86 pins today, most of them in
  kinds the aerial pass did not cover. The list keeps the build green while making each remaining estimate
  visible by name.
- **A pin only moved if it was still the pin that was measured.** Three days and 27 commits passed between
  the measurement and the move, including other sessions re-pinning pools, markets and golf courses. The
  apply script refused any row whose current pin differed; none did.

## What changes on the site

For the 148 places, these now point at the amenity:

- the **Directions** link;
- the static and interactive maps;
- the JSON-LD `geo`;
- the "nearby" links.

One playground line changes: Staring Lake's nearest splash pad (Homeward Hills) goes from 1.8 mi to 1.7 mi.
Elm Creek's line is unchanged. Its nearest pad, Mississippi Crossings, is a low-confidence row and did not
move.

## Not done (still open)

- **Held:** the 43 low-confidence rows and the 14 amenities not found.
- **Registry addresses that point at the wrong building** (six, listed in the report): for example
  Riverfront 13 says Anoka but is in Fridley, and Harriet Alexander has Roseville City Hall's address.
- **Shoreview Commons:** its playground page says "Splash pad at this park", and no outdoor pad was found.
- **`scripts/places-coord-audit.ts`** will now report many of these rows as far from their address. That's
  expected for a park amenity, and the script writes nothing.

## Gate (observed on this tree: `origin/main` 288c1d9 + this branch)

- `npx tsc --noEmit`: clean.
- `npm test`: **3,424 passed in 156 files.** The first run had one failure in `corrections.test.ts`. That's
  the known Windows-checkout problem: `scripts/apply-correction.ts` is written with CRLF here and LF in the
  repo. Converting that working file to LF fixed it, and the conversion leaves no git diff.
- **Mutation checks**, three deliberate breaks, each failing with the right message:
  - re-padding a moved pin;
  - re-reading a listed pin but leaving it listed;
  - dropping a listed pin from the list.
- `npm run build`: clean, 633 static pages.
- `npm audit`: 0 vulnerabilities.
- **Built HTML checked:** Lake Nokomis Main Beach, the Minnesota Valley refuge and Riverfront 13 carry the
  new coordinates in their Directions link and JSON-LD, with no old coordinate left. There was no browser
  check: a worktree has no Mapbox token, so the map image can't render locally.

## Deploy

1. `git fetch origin main && git rebase origin/main`. If `main` moved, re-run `npm test`.
2. `git push origin HEAD:main`. Vercel deploys. The branch also carries the audit report commit (docs only).

## Verify (production)

Use **www** and `curl -L`; the apex 308s. If a page looks stale on a phone, unregister the service worker
first.

- [ ] `curl -sL https://www.citypulsemn.com/places/beach/lake-nokomis-main-beach | grep -c "44.912133,-93.242435"` returns 1 or more
- [ ] `curl -sL https://www.citypulsemn.com/places/disc-golf/riverfront-13-disc-golf | grep -c "45.057644"` returns 1 or more
- [ ] On a phone, Lake Nokomis Main Beach → **Directions** opens on the beach by the beach house, not the ball fields
- [ ] On a phone, Four Paws Dog Park → **Directions** opens at Plymouth Playfield, not in Medicine Lake

## Rollback

Revert the commit. It's registry data and one test, with no database involved. One row can also be put
back by hand: its comment holds the old pin.
