# Deploy — resolving the clashes with evidence (26 Aug 2026)

## What shipped

**Conflicts 24 → 15.** Fourteen listings hidden, none of them on a guess.

Three parts:

1. **A new primary source** — the Minneapolis Park Board, covering the Lake
   Harriet Bandshell.
2. **`npm run resolve-conflicts`** — hides the unverified side of a clash *only*
   when the other side is source-verified.
3. Everything else reported and left alone.

## Why a new source rather than a rule

A clash is two different things claimed in one room at one time, so at most one
is real. Deciding which needs evidence. Seventeen of the twenty-four had none on
either side, and picking a winner there is a coin toss dressed as a decision —
the wrong call deletes a real event.

Four of them were the Lake Harriet Bandshell, which turned out to have a primary
source after all: the Park Board runs The Events Calendar with its REST API open.

It was worth looking. **Ten of our fourteen bandshell listings named a band the
Park Board does not have that night**, and on 30 August *both* our listings were
wrong — the calendar says "Matty & The Subtle Validation" and "The Long
Honeymoon", we had "Prior Lake Brass" and "Junior and The Jukes".

## Two instruments agreeing

The music importer had already seen those rows and flagged them `unmatched`
rather than hiding them — its safety valve, on the grounds that a fuzzy title
miss is likelier than a venue forgetting a show. That is right in isolation.

The clash check is independent evidence arriving from a different direction: the
room is occupied at that hour by a show the venue's own calendar confirms. One
instrument guessing is a guess. Two agreeing is a finding, and that is the only
thing `resolve-conflicts` acts on.

## What it hid

| | |
|---|---|
| Lake Harriet Bandshell | 10 listings naming the wrong band |
| First Avenue, 14 Sep | "Larry Fleet" and "The Rapture" — the venue says Kamelot |
| Turf Club, 4 Oct | "Swervedriver" — the venue says The Dream Syndicate |
| Allianz Field, 19 Sep | the abbreviated "MNUFC vs. LA Galaxy" duplicate |

## Safety

Dry run by default. Nothing deleted — losers become `draft`, reversible. Backup
written, one `admin_audit` row each (`resolve_conflict`) naming the listing that
won and why.

The Park Board feed pages at 50 and **404s past the last page**, so the page count
comes from the payload's `total_pages` rather than a guess. A guess either 404s —
which the all-or-nothing rule turns into "source unavailable" — or silently
truncates the calendar, and a truncated calendar is exactly the input that makes
this importer hide real shows. Capped at 20 pages so a bad `total_pages` cannot
loop us into their site.

Only the bandshell is claimed. The same feed carries buckthorn-slaying volunteer
mornings and park markets citywide; those are real, and claiming them would make
this importer authoritative over things it never read.

## Deploy steps

1. Merge to `main`. Nothing is build-time.
2. **No new secrets.** The Park Board feed is public and unauthenticated.
3. The Parks source runs with the weekly `import-music` step.
   `resolve-conflicts` is manual, like `dedupe-flagged` — it acts on evidence,
   but it still archives listings, so a person starts it.

## Verify

```bash
npm run resolve-conflicts
```

Expect `0 decided by evidence`, `15 left for a person`.

## Rollback

From `admin_audit`, action `resolve_conflict` — it carries every id, the status it
was set to, and the listing it lost to. Recipe in `docs/ADMIN.md` under "Undoing a
bulk change". The `--backup=` file is a convenience for whoever ran the script,
not a durable record. Or one click per row in Admin → Events.

## Quality gate

`npx tsc --noEmit` clean · **1416/1416** tests (+7) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · ran the digest and read the rendered section.

## The 15 that remain, and why they are not a to-do list for a script

Neither side is verified in any of them. They split two ways:

**Probably duplicates** (~10) — the Children's Museum's "First Free Sunday"
listed twice, the Ordway's SPCO opening weekend, Carpenter's apple festival,
Scream Town's opening night, the Renaissance Festival's Phantom's Feast, Lakewood
Cemetery's autumn walk, the Armory's Shaboozey (spelled two ways), the Varsity's
Citizen. The duplicate matcher was deliberately tightened on 22 Aug to stop it
archiving real events, and these fell out the safe side of that. Loosening it to
sweep them up would undo a fix that was paid for.

**Genuinely different** (~5) — Ruthie Foster vs the John Jorgenson Quintet at
Hopkins; two performances at the Walker; "Oh, Mary!" vs "Mystic Pizza" at the
Ordway Music Theater; the SLP Art Fair vs a street-food festival at the same
outdoor centre. One of each pair is false and no instrument here can say which.

Both groups want the same thing: **a primary source for those venues.** The
Ordway and Hennepin Arts sell through Ticketmaster, which is the key that is
still outstanding.
