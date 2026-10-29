# Grant evidence pack

*Assembled 29 October 2026. **This is source material, not an application.** It
exists so that writing one is a day's work rather than a month's, and so that
every number in it is one we have actually measured.*

**Standing rule for this document:** every figure carries the date it was
measured and, where it is reproducible, the command. These move daily — four of
them moved during the two days this pack was assembled. A funder who checks and
finds a number stale is a smaller problem than one who checks and finds it
invented, but both are avoidable.

---

## 1. What this is

City Pulse MN (**citypulsemn.com**) is a Minneapolis–St. Paul events calendar:
concerts, sports, family outings, festivals, and the genuinely unusual, with a
weekly email and a public archive. It is run by **one person**, part-time, and
has been live and publishing continuously since early 2026.

The thing that distinguishes it from a listings aggregator is not the calendar.
It is the **published method for deciding whether a listing is true**, and the
public record of the times that method failed. Sections 3 to 6 are that record.

**Stated plainly, because a program officer will ask in the first screen:** the
operator is an individual, not a 501(c)(3). Any funder on the list in section 8
that requires nonprofit status would need a fiscal sponsor, and no fiscal
sponsorship is currently in place. This is the single biggest eligibility
constraint on everything below and it is not yet resolved.

## 2. Scale, measured

| | Measured 29 Oct 2026 | How |
|---|---|---|
| Published events | 764 | `select status, count(*) from events` |
| Upcoming | 617 | same, `start_at > now()` |
| Archived (never deleted) | 4,102 | same |
| Places (evergreen guide entries) | 569 | `grep -c "slug:" lib/places.ts` |
| Event views, 30 days | 6,073 | `event_stats`, action `view` |
| Ticket clicks to organisers, 30 days | 1,444 (23.8% CTR) | `event_stats`, action `ticket_click` |
| Distinct organisations we sent traffic to, 30 days | 119 | `event_stats` joined to `events.ticket_url` |
| Email subscribers | 47 | `subscribers`, status `subscribed` |
| Last weekly send | 45 recipients | `digest_sends` |
| Search share of visits | ~47% | `referrer_stats`, 30 days |
| Test suite | 2,869 tests in 144 files | `npm test` |
| Public iCal feeds | 79 slugs, 18 empty in a given 30-day window | `allFeedSlugs()` + `selectFeedEvents` |

**The honest reading of these numbers.** This is a small audience. 6,073 event
views and ~6,042 visits in 30 days are near-identical, so a visit averages about
one page — these are pageview-scale counts, not unique readers, and we do not
have a verified unique-reader figure. 47 subscribers is small by any standard.

**The number that is not small** is 1,444 ticket clicks a month across 119
distinct organisations. That is the civic function working: people finding a
thing to go to, and going. It is also the number that grew 7.5× in eleven weeks
while subscribers grew 9×.

## 3. The method

Weekly, a research pass reads venue calendars across the metro and writes what it
finds. Events auto-publish — **there is no human review gate before publication**,
and the honest description of the loop is machine discovery plus machine
reconciliation plus an operator in the *correction* path, not the publication
path. Layered on top:

- **A verify pass**, twice weekly, that re-checks listings against their cited
  sources. It is budget-capped, so it covers a rotating subset rather than
  everything.
- **A source check** on a rolling rotation, which fetches the page a listing
  cites and asks whether that page still supports the claim.
- **A self-check** that looks for contradictions — the same event listed twice,
  two events in one room at one minute, placeholder venues. It reports; it does
  not act. Acting is a separate, dry-run-by-default operator command.
- **A reader report form**, checked automatically before the operator sees it,
  with one-tap decisions by email.
- **Coverage floors** per category, which warn when a category thins out.

Standing data rules, each one written after something went wrong:

- **Never delete an event — archive it.** (With the caveat in section 6.)
- **Never merge games across different days**, however similar the titles.
- **Honest emptiness:** where a fact is not attested, use the conservative floor
  and flag it. No invented content, no placeholder filler.
- **True spans, never capped expansions** for multi-day events.

## 4. Where the method failed, and what we built

This is the section a funder should read first, and the reason this pack exists.
Three documented failures in 2026, each of which produced a shipped change.

**August — the Twins listings.** Thirteen of twenty baseball listings were wrong.
Produced the sports rule (never merge across days) and a primary-source importer
for schedules.

**September — an invented listing.** A reader caught, through the report form, a
listing for an event that did not exist. **The verify pass had already confirmed
it.** That is the worst shape of failure available to this project: the
instrument said yes about something that was not real. Produced automatic
checking of reports before the operator sees them, and one-tap email decisions.

**October — eight year-shifted rows.** Eight listings carried the right event on
the wrong year's date, and **six of the eight had been stamped verified** — the
model had confirmed them against last year's page. Caught by the operator's own
dead-citation sweep, not by a reader and not by the report form. Produced a rule
that a confirmation must quote the date it read, and that an unproven or
wrong-year result withholds the stamp.

**What we are careful not to claim about these.** The fixes constrain
*confirmation*; they do not prevent a wrong listing being created in the first
place, and both deploy guides say so in their own words. The year gate shipped
28 October without a paid test batch — the next scheduled run is its first real
test, and it exits non-zero if it stamps nothing. The matching blind spot in the
source check, which still matches month and day only, is **named as unfixed**.
The September retroactive sweep re-checked only the 30 agent-made stamps among
478 and deliberately changed no statuses.

## 5. The instrumentation habit

A recurring pattern, and the most transferable thing here: **the instruments were
reporting success while the thing they measured was broken.**

- A weekly collapse archived ~20 rows and the importer woke them the same run;
  the counter counted *plans*, not writes, so the panel read clean through five
  failed weeks.
- The self-check reported 0 duplicates while 8 sat live, because a skip ran
  before the test.
- A cost tile read $22.78 while the vendor console read $181.87.
- The verification section could not raise a flag, so a dying verify pass made
  the weekly health email *greener*.
- The source check had been dead for four consecutive weeks — **and the workflow
  conclusion was failure and the health tile was red for four Mondays, and
  neither produced action.**
- Most recently, and found while assembling this pack: the test suite was
  counting three git worktree copies of itself and reporting 9,970 tests where
  the repository has 2,869.

The standing rule those produced: **a measurement that knows it is partial must
not render as a pass. Grey is not green; a floor is not a total.**

**What we must not claim about this.** It is not automated self-correction. In
every case the pattern is: a human notices, a person runs a query, and a rule is
then encoded. The honest claim is a documented habit of auditing its own
instruments and writing down what it finds — not a system that catches itself.

## 6. Known gaps, stated before anyone measures them

A funder who finds these unaided trusts nothing else in the pack.

- **Verification is partial.** Dozens of published upcoming listings have never
  been verified, and a large share of cited pages have never been source-checked.
  There is no verified badge on the site, so a reader cannot tell which is which.
- **No accuracy rate exists.** There is no denominator and no evaluation harness
  for model output. The available facts are incident counts, not a percentage.
- **Coverage is narrower than the prose implies.** 16 neighborhoods defined as
  radius circles, 47 venues in the sweep registry. "Every venue in the Twin
  Cities" would be false. Which communities that leaves out is not currently
  stated anywhere, and should be.
- **Archiving is not a takedown.** Archived events keep rendering their page;
  only `draft` removes it. The phrase "we never delete" is true and could easily
  mislead.
- **The weekly email has gone out without a physical postal address since
  17 September**, which CAN-SPAM requires. The plumbing was fixed 29 September;
  one configuration value is still unset.
- **Scheduling drifts.** Runs are dropped and delayed by hours by the scheduler;
  a clock-time guarantee would be false.

## 7. What it costs, and what money would buy

**Partly unestablished, and that is itself a finding.** Model spend is ledgered
per job — roughly $10 in the first four recorded October runs, with the verify
pass historically the largest single line at around $8.55 a run. Hosting,
database, email and domain costs exist on invoices that **have never been added
up**, and there are two overage incidents on record (database egress in August,
compute in August). Any budget line in an application would be the first time the
full figure has been assembled, and that assembly is a prerequisite, not a
formality.

**How it earns today, disclosed before anyone finds it.** Effectively nothing. An
affiliate-tagging seam exists in the code and is **switched off**, because
measurement showed 1.9% of outbound ticket clicks reach an affiliate-able
destination — about $6 a month. A reader support link is built and dark. There is
no advertising on the site, no tracking pixels, and no paid placement of any kind:
*no pay-to-list, no pay-to-rank, ever* is a published commitment, and featured
placement, where it is ever sold, is labeled, capped, and never reorders the
organic calendar. The current revenue plan is a venue-side relationship — see
`ROADMAP-MONETIZATION.md`, which also records what was tried and abandoned.

**What this means for sustainability after a grant:** the plan is not audience
scale. It is a small number of local business relationships, built on the 1,444
monthly clicks the site already sends them. That is written down and measured
rather than hoped for.

## 8. Funding leads — unverified, and to be confirmed before use

**Read this heading literally.** A research pass found these names. Almost none of
the specifics could be confirmed from a primary source: several funder sites
blocked automated access, several programs appear to be closed or dormant, and at
least one "program" surfaced only from an AI-generated roundup and is contradicted
by the funder's own site. **Do not put any figure or deadline from this section
into an application without loading the funder's own page first.**

| Lead | Why it might fit | What must be checked |
|---|---|---|
| **LION Publishers** | Membership org for independent local publishers; has historically run audits and implementation grants | Whether an events calendar meets their "mostly original local news and information" bar. **One email answers this and costs nothing — it gates the cheapest on-ramp on this list.** Dues and grant figures found are from past cycles |
| **Press Forward / Press Forward Minnesota** | The largest current local-news funding effort; the Minnesota chapter has funded small outlets | Whether any round is open, and whether for-profit or individual applicants are eligible — the inclusive language found belongs to a closed 2024 round |
| **Bush Foundation** | Minnesota-region funder | Their fellowship explicitly excludes funding a project or a business. Their other grant programs were not examined |
| **Knight Foundation** | Major journalism funder; St. Paul and Duluth are Knight communities (**Minneapolis is not**) | Whether they accept unsolicited applications at all |
| **Minneapolis Foundation · Saint Paul & Minnesota Foundation** | Local community foundations | Both appear to fund individuals rarely or not at all; one program explicitly excludes the direct work of individuals |
| **Institute for Nonprofit News** | Offers fiscal sponsorship to some applicants | Members generally need their own 501(c)(3); sponsorship is selective |
| **Reynolds Journalism Institute · Tiny News Collective · Local Media Association · Hacks/Hackers** | Fellowships and support programs for small publishers | Status, eligibility and whether any are currently active — several showed no 2026 activity |

**Not examined at all**, and plausibly a better fit than half the list above:
Minnesota arts, humanities, heritage and tourism funders (State Arts Board,
Metropolitan Regional Arts Council, Minnesota Humanities Center, Explore
Minnesota), plus the Pivot Fund, Local Media Association programs and
Report for America. An events calendar may read more naturally as *cultural
infrastructure* than as *journalism*, and the arts funders have not been looked
at once.

## 9. What this pack still needs

Honest list of what would make it fundable rather than merely accurate:

1. **The 501(c)(3) / fiscal sponsorship decision.** Gates most of section 8.
2. **A real annual cost figure.** Add up the invoices.
3. **Outside vouching.** There is currently *zero* third-party evidence here —
   no venue, reader, organiser or peer organisation says anything. Three venues
   giving two sentences each would change the document's character more than any
   number in it.
4. **A coverage-boundary paragraph.** Which cities, which suburbs, who is left
   out — written by us before it is measured by someone else.
5. **One email to LION** about scope eligibility.

---

*Companion documents: `ROADMAP-MONETIZATION.md` (what was measured and
abandoned), `ENGINEERING.md` (the standing rules and the incidents that produced
them), `VERIFICATION.md` and `REPORT-CHECKS.md` (the method in detail),
`HANDOFF.md` (current open items, with owners).*
