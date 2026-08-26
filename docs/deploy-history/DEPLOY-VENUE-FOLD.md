# Deploy — one room, one grouping key (26 Aug 2026)

## What shipped

Two small things asked for, and one correction that turned out to matter more
than either.

1. **The `import_music_review` flag is self-clearing**, and now surfaces in the
   ops digest Queue.
2. **The self-check folds venue spellings** onto the room they name.
3. The one genuinely-open review item — a duplicate — is archived.

## Reading the 19 flags, which is what started this

Eighteen were already resolved. `resolve-conflicts` had closed 13 and
`hide-placeholders` 5, as evidence arrived from the importers. The queue drained
itself; nobody needed to work it.

**One was still live**, and I explained it wrongly at first. Our listing said
`"Rudy De Anda"`; First Avenue's calendar said `"Trish Toledo with Rudy De Anda"`.
I put that down to the title matcher failing on a support-act billing.

It wasn't. The matcher handles that case fine — one title contains the other. The
verified row sat at venue `"Turf Club (St Paul)"` and the duplicate at
`"Turf Club"`, and `findContradictions` grouped on the raw venue string, so **the
two never met.**

## The rule that was wrong

Until now the self-check grouped by the literal venue text, documented as
deliberate: *two spellings of one room are their own bug, and folding them here
would hide it behind a clash report.*

That reasoning cost more than it saved. Two spellings **are** one physical room.
Not folding them doesn't preserve a signal, it just loses contradictions.

Now it groups by `roomKey()`, and the fragmentation is reported in its own right
as `venueSpellings` — surfaced directly instead of inferred from clashes that go
missing. **Eighteen rooms are currently spelled more than one way.**

## The restriction that makes it safe

`roomKey` strips a trailing parenthetical **only when it is a city**.

That is the whole point. `"First Avenue & 7th St Entry (7th St Entry)"` ends in a
parenthetical too, and there it names the *other room*. Folding the Entry into the
Mainroom would turn every Entry show into a phantom of whatever the Mainroom was
doing — pinned by a test.

It deliberately does not touch `canonicalizeVenue`, which feeds `event_key`.
Editing that would re-key the database.

## What the fold immediately found

**Clashes 15 → 19.** The number went up because the instrument got better, not
because the calendar got worse. Four contradictions were invisible purely because
of spelling:

- **The Armory, 3 Sep** — `"Drake (with NAV)"` at "The Armory" and
  `"Young Thug with NAV"` at "The Armory (Minneapolis)". Two different headliners,
  one room, one night, both live on the site.
- **Walker McGuire Theater, 9 and 15 Oct** — Dorothée Munyaneza's *Tituba* and
  Moriah Evans' commission, each listed twice across two spellings.

Also fixed while looking: `"Multiple Locations"` was not in the placeholder-venue
list, only `"multiple venues"`. Placeholder venues 6 → 8.

## The flag is self-clearing because it is computed, not stored

The flag is an append-only `admin_audit` row, so the count has to come from the
listing's **current state**: still published, still unverified, still upcoming.
Once a later pass hides or verifies it, the item closes itself.

Nineteen flags were only ever one open item. The digest now says so, in the Queue
section, without alerting — a queue is not an emergency.

## Quality gate

`npx tsc --noEmit` clean · **1421/1421** tests (+5) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · ran the digest and read both sections.

## Still open

- **19 clashes**, all with neither side verified. The four new ones are as
  undecidable as the rest without a source — though the Armory pair is the
  strongest argument yet for the Ticketmaster key, since it sells that room.
- **8 placeholder venues.**
- **18 rooms spelled more than one way.** The fold means this no longer hides
  contradictions, but the underlying data is still fragmented, and it still
  splits venue pages and filters. That is a normalization pass, not a check.
