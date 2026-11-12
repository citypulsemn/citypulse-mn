# Places pins vs. the thing they mark — measured 9 November 2026

**Status, 12 Nov 2026:** the 148 high- and medium-confidence pins below have been moved
(`docs/deploy-history/DEPLOY-PLACES-REPIN-AMENITIES.md`). The 43 low-confidence rows and the 14 not-found
rows are unchanged.

**A measurement, not a fix.** Follow-up to the playground "Before you go"
item (`e5c81ba`, `docs/deploy-history/DEPLOY-PLAYGROUND-BEFORE-YOU-GO.md`), which found 7 of 14
playground pins more than 700 m from the playground, and Waterford's in Lake Waconia.

## The answer

- **235 entries measured**: every beach, splash pad, sledding hill, disc-golf course, dog park,
  nature center and park in `lib/places.ts`.
- **191 (81%) are more than 150 m from the amenity.** 84 are more than 1 km off and 5 are more than
  5 km off. The median miss among the 191 is about 900 m. Only 30 pins are within 150 m.
- **14 amenities couldn't be found on the photo.** Most of them postdate it (table below).
- **It's not only park reserves.** All 45 beaches are off. Several sit in open water (Thomas Beach,
  both Lake Harriet beaches). Five are on the wrong lake:
  - all three Cedar Lake beaches sit on Lake of the Isles;
  - Lake Owasso's sits on Lake Josephine's bathhouse;
  - Turtle Lake's sits on a wetland west of Lexington.

  City splash pads and dog parks are often a block away, sometimes kilometres. The worst cases:
  - Four Paws dog park is in Medicine Lake;
  - the Minnesota Valley refuge is on the roof of the Mall of America;
  - Riverfront 13 is in the wrong city, 18 km away.

| Kind | Measured | Over 150 m | Over 1 km | Not found |
|---|---:|---:|---:|---:|
| beach | 45 | 45 | 18 | 0 |
| splash-pad | 49 | 26 | 3 | 9 |
| sledding | 14 | 12 | 6 | 1 |
| disc-golf | 32 | 25 | 14 | 0 |
| dog-park | 58 | 50 | 24 | 3 |
| nature-center | 16 | 14 | 11 | 1 |
| park | 21 | 19 | 8 | 0 |
| **all** | **235** | **191** | **84** | **14** |

### Why the pins are wrong: two causes

1. **Estimates padded to look precise.** 86 of the pins with a found amenity are written like
   `lat: 45.3350, lng: -93.2900`. That is a 3- or 2-decimal guess with zeros added. **85 of those 86
   are more than 150 m off.** Three of the not-found rows are padded too. The registry guard asks for at least 4 *written* decimals, so the
   padding gets past it. The guard was meant to stop exactly this shape (see PLACES.md, "The
   coordinate specifically"). These rows are marked ᵖ in the table.
2. **The address is not where the thing is.** The other 106 pins that are off have real-looking
   coordinates, so they were looked up, but the address was the wrong place to look up:
   - a park reserve's headquarters or entrance;
   - a city hall: North Valley disc golf, Harriet Alexander;
   - a parks-department office: Chaska Lions dog area;
   - the park's street address, a block from the pad.

   The 6 September coordinate audit compares each pin with that same address, so it could not
   see any of this. For a park, the address is not the amenity.

### What a wrong pin does on the site

The pin drives:

- the **Directions** link on every place page;
- the static and interactive maps;
- the "nearby" links;
- the JSON-LD `geo` that search engines read;
- the playground pages' "nearest splash pad" line.

Moving the splash-pad pins changes four of those playground lines by 0.1–0.3 mi. Elm Creek's nearest
pad changes from Mississippi Crossings (2.4 mi) to Maple Grove Central Park (2.7 mi), because
Mississippi Crossings' pin is 2.2 km from the pad.

## Recommendation (Taren's call)

1. **Move the 148 high- and medium-confidence pins in one commit.** Every one has a zoom crop with the
   proposed point on the amenity, and each was checked by eye. A medium point might be tens of metres
   out; the current errors run from 150 m to 18 km. Four `park` pins sit somewhere sensible inside
   their park and could stay if you prefer:
   - William O'Brien: the ranger station, where the DNR's own directions start;
   - Phalen;
   - Como;
   - Boom Island.
2. **Hold the 43 low-confidence pins for a second pass.** In most of them the park is certain and the
   old pin is outside it, but the exact spot is a reading:
   - a sledding slope with no snow;
   - a disc-golf course with no visible tees;
   - an unfenced dog area.

   The rule for that pass: use the proposed point when the park's own page or map names the spot,
   otherwise the park's main lot. Many park-map PDFs could not be read by the tools here; a person
   with a browser can read them.
3. **Decide the 14 not-found rows one by one.** Three may not be what the registry says they are:
   - Zanewood's source is a *Summer Splash event* with inflatables, not a pad;
   - Shoreview Commons has an indoor water park, and the city's playground page lists no spray
     features. **The live Shoreview Commons playground page tells parents "Splash pad at this park"
     from this row**;
   - no source names a sledding hill in Roseville's Central Park.
4. **Fix the guard with the moves.** Count *significant* decimals: strip trailing zeros before
   counting. It's a one-line change, but 194 registry pins fail it today across all kinds, so it can
   only land alongside the fixes (or with a known-list).
5. **Measure the rest next.** 105 padded pins sit in kinds this pass didn't cover:

   | Kind | Padded pins |
   |---|---:|
   | golf courses | 31 |
   | pools | 15 |
   | museums | 11 |
   | rinks | 10 |
   | orchards | 8 |
   | indoor playgrounds | 8 |
   | trampoline gyms | 8 |
   | gardens | 5 |
   | ski hills | 4 |
   | farmers markets | 4 |
   | playground | 1 |

   Golf courses, orchards and ski hills need this aerial method. Buildings can use the cheaper
   geocoder audit.

## Method

- **Imagery:** Metropolitan Council April 2025 orthophoto (`met25`, public domain) only, through the
  same `wmsll` GetMap request shape as `aerialCropUrl` in `lib/playground-facts.ts`. No Hennepin or
  Dakota 6-inch layers (Nearmap-licensed), and no Google, Bing, Esri or Mapbox tiles.
- **Per entry:**
  1. A 1 km locator crop centred on the current pin, with a metre grid. Big parks also got 2 km.
  2. Find the amenity. The places' own pages and park maps were read only to learn *where* in a park
     to look.
  3. If it was more than 100 m off, a 250 m confirm crop centred on the proposed point, with the grid
     refined to 25 m.
  4. The coordinate is read off the grid (6 decimals). Distance is haversine.
- **What "the amenity" means:**
  - beach: centre of the sand;
  - splash pad: the pad;
  - sledding: the slope;
  - disc golf: the course start if clear, else the fairway centroid;
  - dog park: centre of the fenced area, or the entrance for areas over 200 m across;
  - nature center: the building;
  - park: the main arrival point (visitor centre or main lot).
- **Who looked:** six parallel readers did the crops. One of them lost the ability to see images
  partway through. A fresh reader re-checked that reader's 26 rows (all ok), and others finished its
  nature centers. **Every zoom crop over 150 m (191) was then checked by eye** on contact sheets, and the arithmetic was re-run from the registry's own
  coordinates: every pin matches `lib/places.ts`, and every distance recomputes within 5 m. No two
  proposed points coincide. The closest pair is the Elm Creek chalet and the Elm Creek disc golf
  start, 17 m apart, at different addresses.
- **Limits:**
  - **Leaf-off April photo.** Anything built after April 2025 isn't on it.
  - **Precision.** Points are good to roughly ±10–20 m.
  - **Third-party coordinates.** For 7 rows (Red Oak, Silver View, Hansen, Galloway, Zachary and
    Alimagnet disc golf, and the Lilydale dog park), a search result showed a course or ramp
    coordinate. It was used only to know where to look; the recorded point was read off the photo.
  - **Blaine Wetland Sanctuary** has no building (the city lists a nature center only as a plan),
    and its Lexington Ave trailhead lot wasn't found on the photo. By the city's map, the pin is more
    than 4 km off.
  - **Harriet Alexander** was read twice, independently, and the two points are 6 m apart.
- **Crops:** every row's crop is a file in the session scratchpad,
  `C:\Users\mccul\AppData\Local\Temp\claude\C--Users-mccul-Documents-Event-Site-citypulse-mn--claude-worktrees-modest-saha-aadef6\9752768a-fd3f-403e-8fe4-a7384cc6c52a\scratchpad\crops\`.
  The table gives the file name; `*-zoom.jpg` is the confirm crop. The contact sheets are in
  `…\scratchpad\sheets\`, and the raw per-entry records (with the full notes) are in
  `…\scratchpad\results\*.jsonl`. **The scratchpad is a temp folder.** Copy it somewhere permanent if
  you want to keep the photos.

## When the pins are moved

- The drift guards in `lib/__tests__/places.test.ts` require **at least 4 written decimals** and
  **no shared pin between different addresses**. The proposed points have 6 decimals and are unique.
- `npm test` covers the playground splash-pad lines. The four changes above are expected.
- `scripts/places-coord-audit.ts` will start reporting moved pins as "far from their address". That's
  correct, and the script writes nothing.
- No playground photo changes: the 14 playground pins are not in this list.
- **Registry addresses that are wrong** (fix alongside):
  - `riverfront-13-disc-golf`: "Anoka", but the park is in Fridley;
  - `north-valley-disc-golf`: Inver Grove Heights City Hall;
  - `chaska-lions-off-leash-dog-area`: the Parks & Rec office;
  - `harriet-alexander-nature-center`: Roseville City Hall, but the city gives 2520 Dale St N;
  - `bryant-lake-regional-park-beach`: the park page says 6800 Rowland Rd;
  - `rice-creek-off-leash-dog-area`: the county lists 5959 Lexington Ave N.

## Every entry more than 150 m off (191)

Sorted by distance. **Conf.**: high means the amenity is unmistakable on the photo; medium means the
park is certain and the exact spot is a reading; low means the spot is a best guess. **In park/area?**
is filled for disc golf, dog parks and parks only. ᵖ means a padded estimate (cause 1).

| # | Entry | Kind | Off by | Proposed lat, lng | Conf. | In park/area? | Where the pin is now | Crop |
|---:|---|---|---:|---|---|---|---|---|
| 1 | `riverfront-13-disc-golf` | disc-golf | 17,992 m | 45.057644, -93.281677 | medium | no | WRONG CITY: pin is in a residential block of the City of Anoka (between the Mississippi and the Rum River), ~18 km from… | riverfront-13-disc-golf-zoom.jpg |
| 2 | `big-marine-park-beach` ᵖ | beach | 8,449 m | 45.204474, -92.871659 | medium |  | pin is on a rural lane in farmland ~8.4 km SSE of the park, not in the park reserve at all, and not near Big Marine Lake | big-marine-park-beach-zoom.jpg |
| 3 | `elm-creek-sledding-hill` | sledding | 5,296 m | 45.143113, -93.425570 | low |  | pin is in a cul-de-sac on the E shore of Weaver Lake by I-94, OUTSIDE Elm Creek Park Reserve, ~5.3 km S of the swim pond | elm-creek-sledding-hill-zoom.jpg |
| 4 | `lake-george-regional-beach` ᵖ | beach | 5,124 m | 45.361506, -93.343630 | medium |  | pin is in woods in Oak Grove ~5 km SE of Lake George, no lake anywhere near it | lake-george-regional-beach-zoom.jpg |
| 5 | `bloomington-nesbitt-off-leash-dog-area` | dog-park | 5,048 m | 44.802501, -93.363851 | high | no | Pin sits in a residential cul-de-sac neighbourhood ~5 km north (near Hyland area), nowhere near W 111th St | bloomington-nesbitt-off-leash-dog-area-zoom.jpg |
| 6 | `red-oak-disc-golf` ᵖ | disc-golf | 4,948 m | 44.783168, -93.233850 | medium | no | pin is on the Fairview Ridges hospital campus by I-35E/Burnsville Pkwy, ~4.9 km SW of the park | red-oak-disc-golf-zoom.jpg |
| 7 | `central-park-brooklyn-park-disc-golf` | disc-golf | 4,688 m | 45.105543, -93.346172 | medium | no | pin is in a different park S of a high school (stadium visible) ~4.7 km N, near Hwy 610 | central-park-brooklyn-park-disc-golf-zoom.jpg |
| 8 | `rice-creek-off-leash-dog-area` | dog-park | 4,676 m | 45.118237, -93.166514 | high | no | pin sits in a residential block at the SE corner of Lexington Ave and the big E-W arterial (Hwy 96 by its position) next… | rice-creek-off-leash-dog-area-zoom.jpg |
| 9 | `lake-sarah-dog-off-leash-area` | dog-park | 4,656 m | 45.072917, -93.711225 | high | no | pin sits in woods on the west side of an unnamed small lake ~4.7 km SW, nowhere near Lake Sarah or the park | lake-sarah-dog-off-leash-area-zoom.jpg |
| 10 | `lake-minnetonka-swim-pond` ᵖ | beach | 4,520 m | 44.894953, -93.669810 | high |  | pin is on ball fields in central Mound, 4.5 km N of the park | lake-minnetonka-swim-pond-zoom.jpg |
| 11 | `lebanon-hills-regional-park` ᵖ | park | 4,454 m | 44.786470, -93.128772 | high | no | pin is in a residential pond ringed by houses, just N of the park's West section, 4.5 km W of the visitor centre the… | lebanon-hills-regional-park-zoom.jpg |
| 12 | `acorn-park-disc-golf` | disc-golf | 4,451 m | 45.018859, -93.112000 | medium | no | pin is at Snelling Ave & County Rd C by the Rosedale-area strip malls, ~4.45 km W of the park (it is NOT at 286 County… | acorn-park-disc-golf-zoom.jpg |
| 13 | `st-croix-bluffs-beach` ᵖ | beach | 3,991 m | 44.798668, -92.786733 | low |  | pin is among private houses on the bluff ~4 km N of the park, opposite the Kinnickinnic delta | st-croix-bluffs-beach-zoom.jpg |
| 14 | `carver-dog-off-leash-area` | dog-park | 3,922 m | 44.873811, -93.654719 | high | no | pin sits in restored prairie beside Victoria Dr (CR 11) ~1 km S of Hwy 7, on the reserve's WEST side, 3.9 km from the… | carver-dog-off-leash-area-zoom.jpg |
| 15 | `swanson-dog-park` ᵖ | dog-park | 3,791 m | 45.137929, -93.236717 | medium | no | Pin is on Central Ave (Hwy 65) median ~3.8 km north, around 109th Ave, beside a strip mall | swanson-dog-park-zoom.jpg |
| 16 | `galloway-park-disc-golf` ᵖ | disc-golf | 3,787 m | 45.201198, -93.419867 | low | no | pin is on a Champlin municipal/public-works campus (water tower, bus yard) by Hwy 169, ~3.8 km SE of the park | galloway-park-disc-golf-zoom.jpg |
| 17 | `crow-hassan-dog-off-leash-area` | dog-park | 3,713 m | 45.207189, -93.621547 | high | no | pin sits on a farmstead/residential lot in Hanover WEST of the Crow River, 3.7 km SW of the area and outside the park… | crow-hassan-dog-off-leash-area-zoom.jpg |
| 18 | `lake-owasso-county-beach` ᵖ | beach | 2,862 m | 45.042100, -93.114933 | high |  | pin is on the WRONG LAKE: it sits on the Lake JOSEPHINE County Park bathhouse/lot off Lexington Ave, ~2.9 km W of Lake… | lake-owasso-county-beach-zoom.jpg |
| 19 | `hyland-lake-sledding-hill` | sledding | 2,841 m | 44.842814, -93.372651 | medium |  | pin is in a wooded creek strip beside a highway interchange N of I-494 (a maintenance yard/commercial area), outside the… | hyland-lake-sledding-hill-zoom.jpg |
| 20 | `spring-lake-dog-off-leash-area` | dog-park | 2,768 m | 44.715506, -93.473183 | medium | no | pin sits in a tilled farm field ~2.8 km NW of the dog area, about 1 km north of CR 82 and outside the park | spring-lake-dog-off-leash-area-zoom.jpg |
| 21 | `running-park-sledding-hill` ᵖ | sledding | 2,538 m | 44.831774, -93.256162 | low |  | pin is in a residential grid ~2.5 km N of the park (coarse 3-dp coordinate) | running-park-sledding-hill-zoom.jpg |
| 22 | `lakeside-commons-splash-pad` | splash-pad | 2,437 m | 45.191544, -93.192617 | high |  | pin is a round-number coordinate on a golf-course clubhouse lot by the diagonal arterial (Radisson Rd), ~2.4 km SW of… | lakeside-commons-splash-pad-zoom.jpg |
| 23 | `springbrook-nature-center` | nature-center | 2,429 m | 45.123418, -93.274194 | high |  | pin sits on Osborne Rd NE beside the Unity Hospital campus in a residential/commercial block, nowhere near the preserve | springbrook-nature-center-zoom.jpg |
| 24 | `kaposia-park-disc-golf` | disc-golf | 2,395 m | 44.909229, -93.062156 | low | no | pin is on a school campus in central South St | kaposia-park-disc-golf-zoom.jpg |
| 25 | `westwood-hills-nature-center` ᵖ | nature-center | 2,344 m | 44.965859, -93.387314 | high |  | pin sits among apartment blocks beside a ballfield/tennis park in a residential grid, 2.3 km S of the nature center | westwood-hills-nature-center-zoom.jpg |
| 26 | `savanna-dunes-disc-golf` | disc-golf | 2,335 m | 45.215884, -93.286138 | low | no | pin is in a residential subdivision S of Main St, outside Bunker Hills entirely, ~2.3 km S of this lot | savanna-dunes-disc-golf-zoom.jpg |
| 27 | `elm-creek-park-reserve` ᵖ | park | 2,301 m | 45.138157, -93.437946 | medium | inside | pin is in woods/prairie in the park's W half near Rush Creek, ~400 m W of the Eastman Nature Center lot (a separate… | elm-creek-park-reserve-zoom.jpg |
| 28 | `mississippi-crossings-splash-pad` | splash-pad | 2,246 m | 45.186905, -93.391701 | low |  | pin is on a Hwy 169 retail/office lot ~2.2 km S of the venue (not near the river) | mississippi-crossings-splash-pad-zoom.jpg |
| 29 | `silverwood-visitor-center` | nature-center | 2,206 m | 45.046565, -93.224584 | high |  | pin is in a residential block E of the HUSKIES-lettered high-school stadium (audit: probably St | silverwood-visitor-center-zoom.jpg |
| 30 | `highland-park-disc-golf` | disc-golf | 2,190 m | 44.913464, -93.155258 | medium | no | pin is in the residential blocks of Highland Park neighbourhood near Cleveland Ave, ~2.2 km W of the course and not in… | highland-park-disc-golf-zoom.jpg |
| 31 | `meeker-island-off-leash-dog-park` | dog-park | 2,137 m | 44.961055, -93.217308 | low | no | pin sits at the E end of the Lake St-Marshall Ave bridge (Marshall Ave / Cretin area, by the Town & Country golf… | meeker-island-off-leash-dog-park-zoom.jpg |
| 32 | `harriet-alexander-nature-center` | nature-center | 2,023 m | 45.016629, -93.125485 | high |  | Pin sits in a residential block S of Hwy 36 near Lexington | harriet-alexander-nature-center-zoom.jpg |
| 33 | `minnesota-valley-wildlife-refuge` ᵖ | park | 1,946 m | 44.859748, -93.216240 | high | no | pin is on the ROOF OF THE MALL OF AMERICA, ~2 km W of the refuge visitor center | minnesota-valley-wildlife-refuge-zoom.jpg |
| 34 | `ham-lake-disc-golf` ᵖ | disc-golf | 1,938 m | 45.251234, -93.222013 | medium | no | pin is in a large-lot residential area ~1.9 km SSE of the park, not in it | ham-lake-disc-golf-zoom.jpg |
| 35 | `staring-lake-sledding-hill` ᵖ | sledding | 1,908 m | 44.835953, -93.462197 | medium |  | pin is in a residential neighbourhood near Eden Prairie city centre, ~1.9 km N of Staring Lake and outside the park | staring-lake-sledding-hill-zoom.jpg |
| 36 | `highlands-park-splash-pad` ᵖ | splash-pad | 1,881 m | 44.821001, -92.918968 | low |  | pin is a round-number coordinate in wetland/scrub by a pond S of Hwy 61, with no park in 1 km | highlands-park-splash-pad-zoom.jpg |
| 37 | `turtle-lake-county-beach` ᵖ | beach | 1,847 m | 45.092144, -93.130984 | medium |  | pin is on the WRONG LAKE: a bog-island wetland lake W of Lexington Ave, ~1.8 km W of Turtle Lake | turtle-lake-county-beach-zoom.jpg |
| 38 | `lowry-nature-center` ᵖ | nature-center | 1,844 m | 44.882474, -93.683449 | high |  | Pin sits at the sledding hill / trail junction W of the diagonal Victoria Dr (CR 11), which is where the park map prints… | lowry-nature-center-zoom.jpg |
| 39 | `flying-cloud-dog-park` | dog-park | 1,838 m | 44.873696, -93.414257 | high | no | Pin sits in the middle of a stormwater pond by the I-494/US-212 interchange | flying-cloud-dog-park-zoom.jpg |
| 40 | `staring-lake-disc-golf` ᵖ | disc-golf | 1,833 m | 44.832719, -93.458332 | medium | no | pin is on a small neighbourhood park/playground ~1.8 km N of Staring Lake, not in Staring Lake Park | staring-lake-disc-golf-zoom.jpg |
| 41 | `bryant-lake-dog-off-leash-area` | dog-park | 1,795 m | 44.886839, -93.432715 | medium | no | pin sits on a residential street ~1.8 km WSW of Bryant Lake, outside the park entirely | bryant-lake-dog-off-leash-area-zoom.jpg |
| 42 | `garlough-park-disc-golf` ᵖ | disc-golf | 1,791 m | 44.892452, -93.095238 | medium | no | pin is in a residential grid near the St Paul/West St Paul line (3-dp coordinate, sits on a street), ~1.8 km N of the… | garlough-park-disc-golf-zoom.jpg |
| 43 | `eastman-nature-center` ᵖ | nature-center | 1,746 m | 45.154371, -93.449968 | high |  | pin is in floodplain woods beside Elm Creek in the park's N half, no building or road near it | eastman-nature-center-zoom.jpg |
| 44 | `four-paws-dog-park` ᵖ | dog-park | 1,740 m | 45.021215, -93.403363 | medium | no | Pin is in the middle of Medicine Lake | four-paws-dog-park-zoom.jpg |
| 45 | `tamarack-nature-center` ᵖ | nature-center | 1,739 m | 45.101492, -93.038725 | high |  | pin sits in a residential street W of the road along Otter Lake's SW shore, 1.7 km NNW of the building | tamarack-nature-center-zoom.jpg |
| 46 | `afton-state-park` ᵖ | park | 1,736 m | 44.853534, -92.774555 | high | inside | pin is in the wooded Deer Valley ravine ~250 m S of the ranger station/entrance off CR 22 (6959 Peller Ave is the… | afton-state-park-zoom.jpg |
| 47 | `carpenter-nature-center` ᵖ | nature-center | 1,722 m | 44.761813, -92.814104 | low |  | pin is not in Minnesota: it sits in downtown Prescott, WI, on the E bank of the St Croix just N of the US-10 lift… | carpenter-nature-center-zoom.jpg |
| 48 | `white-bear-lake-county-beach` ᵖ | beach | 1,711 m | 45.093924, -92.996712 | high |  | pin is in open water off downtown White Bear Lake, N of Manitou Island | white-bear-lake-county-beach-zoom.jpg |
| 49 | `brockway-disc-golf` ᵖ | disc-golf | 1,694 m | 44.751234, -93.122597 | medium | no | pin is on a rail wye / apartment construction site in downtown Rosemount, ~1.7 km S | brockway-disc-golf-zoom.jpg |
| 50 | `lake-mccarrons-county-beach` | beach | 1,688 m | 44.996314, -93.107595 | high |  | pin is in a residential cul-de-sac ~1.7 km W of Lake McCarrons, not at the lake at all | lake-mccarrons-county-beach-zoom.jpg |
| 51 | `lake-elmo-swim-pond` | beach | 1,678 m | 44.984011, -92.891897 | high |  | pin is at the park entrance contact station on Keats Ave N, ~1.7 km SSW of the swim pond | lake-elmo-swim-pond-zoom.jpg |
| 52 | `murphy-hanrehan-dog-off-leash-area` | dog-park | 1,678 m | 44.724681, -93.347156 | low | no | pin sits on a private farmstead/horse property (barns, paddocks, pond) ~1.7 km SW of the reserve's Main Trailhead… | murphy-hanrehan-dog-off-leash-area-zoom.jpg |
| 53 | `brookdale-dog-park` ᵖ | dog-park | 1,664 m | 45.093026, -93.333429 | medium | no | Pin is on a road beside Palmer Lake wetlands ~1.7 km SE (Brooklyn Center side) | brookdale-dog-park-zoom.jpg |
| 54 | `van-valkenburg-off-leash-dog-area` ᵖ | dog-park | 1,663 m | 44.914737, -93.398073 | medium | no | Pin is in a cul-de-sac residential area ~1.7 km SE, west of a lake | van-valkenburg-off-leash-dog-area-zoom.jpg |
| 55 | `plymouth-dog-park` | dog-park | 1,652 m | 45.060694, -93.496327 | medium | no | Pin is on a playground in a different park ~1.6 km south (by Peony Ln, north of Wayzata HS) | plymouth-dog-park-zoom.jpg |
| 56 | `silverwood-park` ᵖ | park | 1,640 m | 45.047193, -93.225664 | high | no | pin is in a residential block just NW of a high-school stadium lettered HUSKIES (audit: probably St | silverwood-park-zoom.jpg |
| 57 | `stillwater-dog-park` | dog-park | 1,614 m | 45.058302, -92.832676 | high | no | Pin is on Myrtle St in downtown Stillwater (near the 200 block), ~1.6 km E | stillwater-dog-park-zoom.jpg |
| 58 | `bryant-lake-regional-park-beach` ᵖ | beach | 1,581 m | 44.881226, -93.428726 | high |  | pin is in a residential subdivision ~1.6 km WSW, not in the park | bryant-lake-regional-park-beach-zoom.jpg |
| 59 | `dodge-nature-center` ᵖ | nature-center | 1,559 m | 44.891987, -93.100531 | medium |  | pin sits in a residential grid N of Wentworth Ave W, ~880 m north of the property's north edge | dodge-nature-center-zoom.jpg |
| 60 | `bunker-hills-regional-park` ᵖ | park | 1,530 m | 45.210114, -93.285255 | medium | no | pin is in a vacant wooded parcel ~150 m N of Main St (CSAH 14), between a subdivision and a tree farm, ~600 m E of… | bunker-hills-regional-park-zoom.jpg |
| 61 | `rosland-park-disc-golf` ᵖ | disc-golf | 1,519 m | 44.885210, -93.337236 | medium | no | pin is in the Southdale retail district (big-box parking lot near France Ave & 69th), ~1.5 km SE of Rosland Park and not… | rosland-park-disc-golf-zoom.jpg |
| 62 | `franklin-terrace-off-leash-dog-park` | dog-park | 1,491 m | 44.960554, -93.222118 | low | no | pin sits on E Franklin Ave at about 22nd-23rd Ave S by the I-94 apartments in Seward, ~1.5 km W of the river | franklin-terrace-off-leash-dog-park-zoom.jpg |
| 63 | `cedar-lake-east-beach` | beach | 1,470 m | 44.961239, -93.318313 | medium |  | pin is on the WRONG LAKE: water edge of Lake of the Isles E shore (E Lake of the Isles Pkwy) | cedar-lake-east-beach-zoom.jpg |
| 64 | `martin-linwood-beach` ᵖ | beach | 1,439 m | 45.366752, -93.091755 | low |  | pin is in woods beside a school on the Hwy 22 curve, ~1.4 km W of any park beach | martin-linwood-beach-zoom.jpg |
| 65 | `long-lake-regional-park-beach` | beach | 1,386 m | 45.074455, -93.199345 | high |  | pin is in a small residential pond W of Silver Lake Rd in New Brighton, ~1.4 km W of the park across Long Lake | long-lake-regional-park-beach-zoom.jpg |
| 66 | `crosby-farm-regional-park` ᵖ | park | 1,372 m | 44.897709, -93.165952 | high | no | pin is in a Highland Park residential block N of W 7th St, 1.4 km NW of the park and on the far side of Shepard Rd and… | crosby-farm-regional-park-zoom.jpg |
| 67 | `hansen-park-disc-golf` ᵖ | disc-golf | 1,356 m | 45.055845, -93.206653 | low | no | pin is in the MIDDLE OF A LAKE N of I-694, ~1.35 km N of the park | hansen-park-disc-golf-zoom.jpg |
| 68 | `fish-lake-dog-off-leash-area` | dog-park | 1,343 m | 45.081562, -93.465299 | medium | no | pin sits in a residential neighbourhood W of Fish Lake, 1.3 km NW of the park, which is on the lake's south shore | fish-lake-dog-off-leash-area-zoom.jpg |
| 69 | `highland-park-sledding-hill` | sledding | 1,310 m | 44.918762, -93.164252 | low |  | pin is on Montreal Ave where it meets W 7th St, at the far E end of Highland Park ~1.3 km from the towers | highland-park-sledding-hill-zoom.jpg |
| 70 | `cedar-lake-point-beach` | beach | 1,265 m | 44.960458, -93.322643 | high |  | pin is on the WRONG LAKE: Kenwood houses on the NW bay of Lake of the Isles | cedar-lake-point-beach-zoom.jpg |
| 71 | `new-hope-lions-off-leash-area` ᵖ | dog-park | 1,258 m | 45.016498, -93.367141 | medium | no | Pin is in a residential block ~1.3 km west | new-hope-lions-off-leash-area-zoom.jpg |
| 72 | `kroening-nature-center` ᵖ | nature-center | 1,191 m | 45.043276, -93.283284 | medium |  | pin is on the EAST bank of the Mississippi, at an institutional building beside the water-works filter basins by the… | kroening-nature-center-zoom.jpg |
| 73 | `golden-valley-lions-off-leash-pet-area` ᵖ | dog-park | 1,179 m | 44.980241, -93.372214 | medium | no | Pin is on the roof of a large warehouse north of Hwy 55, ~1.2 km NE | golden-valley-lions-off-leash-pet-area-zoom.jpg |
| 74 | `rice-creek-chain-beach` | beach | 1,134 m | 45.165366, -93.080289 | medium |  | pin is on Main St (Cty 14) at the causeway where it meets the park road, between Centerville Lake and the lake to the N | rice-creek-chain-beach-zoom.jpg |
| 75 | `arlington-arkwright-off-leash-dog-area` | dog-park | 1,127 m | 44.981709, -93.082349 | medium | no | pin sits in a townhouse complex WEST of I-35E, ~1.1 km NW | arlington-arkwright-off-leash-dog-area-zoom.jpg |
| 76 | `wargo-nature-center` | nature-center | 1,095 m | 45.182030, -93.085352 | high |  | Pin sits on a N-S road crossing marsh E of the lake chain, ~1.1 km E of the building across a bay and creek | wargo-nature-center-zoom.jpg |
| 77 | `unci-makha-off-leash-dog-park` | dog-park | 1,082 m | 44.912401, -93.193024 | high | no | pin sits in the residential grid of Highland Park ~1.1 km E (around Montreal/Edgcumbe), outside the park | unci-makha-off-leash-dog-park-zoom.jpg |
| 78 | `square-lake-park-beach` ᵖ | beach | 1,078 m | 45.153612, -92.795414 | high |  | pin is in a farm field ~1.1 km NNE of the park and E of the lake | square-lake-park-beach-zoom.jpg |
| 79 | `french-regional-park-beach` | beach | 1,073 m | 45.017677, -93.429907 | medium |  | pin is on a high school campus (buildings + football stadium) E of the park, outside French Park | french-regional-park-beach-zoom.jpg |
| 80 | `elm-creek-swim-pond` | beach | 1,057 m | 45.144837, -93.427320 | high |  | pin is on the Elm Creek winter recreation chalet / snowmaking hill area | elm-creek-swim-pond-zoom.jpg |
| 81 | `cleary-lake-dog-off-leash-area` | dog-park | 1,052 m | 44.675476, -93.393786 | medium | no | pin sits on 190th St E at the roundabout ~1 km EAST, among farm fields and houses, outside the area | cleary-lake-dog-off-leash-area-zoom.jpg |
| 82 | `hyland-lake-park-reserve` ᵖ | park | 1,037 m | 44.824825, -93.371668 | high | no | pin is at the water's edge on the E shore of BUSH Lake, just W of East Bush Lake Rd, at the park's W boundary… | hyland-lake-park-reserve-zoom.jpg |
| 83 | `columbia-park-sledding-hill` ᵖ | sledding | 1,027 m | 45.028803, -93.249939 | low |  | pin is in the residential grid E of Central Ave by the rail yard, ~1 km SE of Columbia Golf Club | columbia-park-sledding-hill-zoom.jpg |
| 84 | `minnehaha-off-leash-dog-park` | dog-park | 1,022 m | 44.905212, -93.198194 | low | no | pin sits on the W shoulder of Hwy 55 (Hiawatha) at about E 51st St, beside houses, ~0.6 km N of 54th St and on the wrong… | minnehaha-off-leash-dog-park-zoom.jpg |
| 85 | `north-valley-disc-golf` ᵖ | disc-golf | 983 m | 44.850059, -93.045889 | medium | no | pin is in a townhouse cluster S of the park, ~1 km away | north-valley-disc-golf-zoom.jpg |
| 86 | `lilydale-off-leash-dog-park` ᵖ | dog-park | 953 m | 44.915248, -93.129674 | medium | no | pin sits on Lilydale Rd where it climbs the bluff into the Lilydale (city) residential streets, E of Pickerel Lake… | lilydale-off-leash-dog-park-zoom.jpg |
| 87 | `kaposia-landing-off-leash-dog-area` | dog-park | 942 m | 44.912772, -93.050636 | medium | no | Pin is on a street in the South St | kaposia-landing-off-leash-dog-area-zoom.jpg |
| 88 | `kelley-park-splash-pad` | splash-pad | 935 m | 44.728524, -93.204716 | low |  | pin is on County Road 42 in the retail strip ~940 m NW of the park | kelley-park-splash-pad-zoom.jpg |
| 89 | `huset-park-splash-pad` | splash-pad | 934 m | 45.039192, -93.258700 | medium |  | pin is on the Central Ave / 40th Ave corner building, ~930 m E of the pad | huset-park-splash-pad-zoom.jpg |
| 90 | `cedar-lake-south-beach` ᵖ | beach | 930 m | 44.953604, -93.320599 | high |  | pin is on the WRONG LAKE: S shore of Lake of the Isles (wooded strip by the channel to Bde Maka Ska) | cedar-lake-south-beach-zoom.jpg |
| 91 | `staring-lake-off-leash-dog-area` ᵖ | dog-park | 926 m | 44.832040, -93.448667 | low | no | Pin is on the lake shore sand on the WEST side of the park | staring-lake-off-leash-dog-area-zoom.jpg |
| 92 | `battle-creek-regional-park` ᵖ | park | 926 m | 44.943659, -93.001376 | high | inside | pin sits on the residential street forming the E edge of the Winthrop section (park pond just W, houses E), i.e | battle-creek-regional-park-zoom.jpg |
| 93 | `miller-park-splash-pad` | splash-pad | 915 m | 44.852763, -93.496244 | medium |  | pin is on Eden Prairie Rd among townhomes N of the park, ~915 m NE of the pad | miller-park-splash-pad-zoom.jpg |
| 94 | `theodore-wirth-disc-golf` | disc-golf | 913 m | 44.990359, -93.328397 | medium | no | pin is on the rail corridor/scrub strip at the park's E edge, ~0.9 km NE of the course, not on it | theodore-wirth-disc-golf-zoom.jpg |
| 95 | `cleary-lake-regional-park-beach` ᵖ | beach | 910 m | 44.690390, -93.389345 | medium |  | pin is in unbroken woodland/wetland ~0.9 km SW of the beach and ~0.5 km S of the lake | cleary-lake-regional-park-beach-zoom.jpg |
| 96 | `fish-lake-regional-park-beach` | beach | 905 m | 45.084656, -93.465792 | medium |  | pin is on Bass Lake Rd (Cty 10) at the park entrance road junction, ~900 m S of the lake | fish-lake-regional-park-beach-zoom.jpg |
| 97 | `dinky-off-leash-dog-park` | dog-park | 888 m | 44.986031, -93.237657 | medium | no | pin sits on a white-roofed building and its lot in SE Como, E of Van Cleve Park, ~0.9 km E and across I-35W | dinky-off-leash-dog-park-zoom.jpg |
| 98 | `mississippi-gateway-dog-off-leash-area` | dog-park | 883 m | 45.138272, -93.318990 | low | no | pin sits ON the Coon Rapids Dam spillway in the middle of the Mississippi | mississippi-gateway-dog-off-leash-area-zoom.jpg |
| 99 | `new-hope-liberty-off-leash-area` ᵖ | dog-park | 861 m | 45.061377, -93.394889 | medium | no | Pin is in a townhouse complex south of Bass Lake Rd, ~850 m SE | new-hope-liberty-off-leash-area-zoom.jpg |
| 100 | `silverview-park-disc-golf` ᵖ | disc-golf | 828 m | 45.104539, -93.217482 | low | no | pin is in a residential grid ~830 m W of the park, not in it (a different small park with ball fields sits ~400 m W of… | silverview-park-disc-golf-zoom.jpg |
| 101 | `chaska-lions-off-leash-dog-area` | dog-park | 823 m | 44.800497, -93.588724 | medium | no | Pin is on the Chaska Community Center (1661 Park Ridge Dr = the Parks & Rec office address, not the park) ~820 m NW | chaska-lions-off-leash-dog-area-zoom.jpg |
| 102 | `cliff-fen-splash-pad` ᵖ | splash-pad | 804 m | 44.787151, -93.276511 | high |  | pin is a round-number coordinate on an office building ~800 m S of the park (the park is not in the 1000 m locator) | cliff-fen-splash-pad-zoom.jpg |
| 103 | `snail-lake-beach` ᵖ | beach | 794 m | 45.067764, -93.123243 | medium |  | pin is on Hwy 96 at the Grass Lake park entrance loop, on the wrong side of the park (Grass Lake section) ~800 m S of… | snail-lake-beach-zoom.jpg |
| 104 | `otter-lake-off-leash-dog-area` ᵖ | dog-park | 790 m | 45.114515, -93.039578 | medium | no | pin sits on the east edge of I-35E behind a row of townhomes, ~0.8 km W of the park and outside it | otter-lake-off-leash-dog-area-zoom.jpg |
| 105 | `lake-gervais-county-beach` ᵖ | beach | 776 m | 45.013707, -93.075222 | medium |  | pin is in woods/houses W of Lake Gervais, ~780 m WNW of the park | lake-gervais-county-beach-zoom.jpg |
| 106 | `wabun-disc-golf` | disc-golf | 774 m | 44.916273, -93.206258 | medium | no | pin is in the residential grid W of Hiawatha Ave/Hwy 55, outside Minnehaha Park, ~770 m SW of the Wabun picnic area | wabun-disc-golf-zoom.jpg |
| 107 | `lake-nokomis-50th-street-beach` ᵖ | beach | 758 m | 44.911953, -93.235162 | low |  | pin is in open water mid-lake | lake-nokomis-50th-street-beach-zoom.jpg |
| 108 | `roosevelt-off-leash-dog-park` ᵖ | dog-park | 743 m | 44.864705, -93.268829 | high | no | Pin is on a residential street (4th Ave grid) ~740 m NW | roosevelt-off-leash-dog-park-zoom.jpg |
| 109 | `st-anthony-parkway-off-leash-dog-park` | dog-park | 706 m | 45.024243, -93.255950 | medium | no | pin sits on Central Ave NE at a commercial lot ~0.7 km E, across the BNSF yard from the park | st-anthony-parkway-off-leash-dog-park-zoom.jpg |
| 110 | `lyndale-farmstead-off-leash-dog-park` | dog-park | 699 m | 44.932443, -93.292784 | medium | no | pin sits in a residential block a few hundred metres E of Lake Harriet, ~0.7 km S of the park (S of W 40th St) | lyndale-farmstead-off-leash-dog-park-zoom.jpg |
| 111 | `powderhorn-park-sledding-hill` ᵖ | sledding | 683 m | 44.943075, -93.259113 | medium |  | pin is in the residential grid ~680 m SW of the park, outside it, and not at the listed address either (3400 15th Ave S… | powderhorn-park-sledding-hill-zoom.jpg |
| 112 | `wirth-lake-beach` ᵖ | beach | 672 m | 44.979963, -93.323266 | high |  | pin is on the Theodore Wirth golf course N of Hwy 55, across the highway from Wirth Lake | wirth-lake-beach-zoom.jpg |
| 113 | `theodore-wirth-regional-park` ᵖ | park | 643 m | 44.991639, -93.326351 | medium | inside | pin is in the middle of a pond on Bassett Creek at the park's E edge (between golf course and the rail line), nothing to… | theodore-wirth-regional-park-zoom.jpg |
| 114 | `theodore-wirth-sledding-hill` ᵖ | sledding | 641 m | 44.993213, -93.322538 | medium |  | pin is in a residential grid E of the park and the rail corridor, outside Wirth Park | theodore-wirth-sledding-hill-zoom.jpg |
| 115 | `lake-josephine-county-beach` ᵖ | beach | 635 m | 45.033162, -93.149264 | low |  | pin is in woods/houses S of the lake by Hamline Ave, outside the park | lake-josephine-county-beach-zoom.jpg |
| 116 | `baker-park-reserve-beach` ᵖ | beach | 631 m | 45.024496, -93.636317 | medium |  | pin is in a wooded wetland island E of Cty Rd 19 near the Baker park road, ~630 m NE of the beach | baker-park-reserve-beach-zoom.jpg |
| 117 | `baker-park-reserve` ᵖ | park | 623 m | 45.021898, -93.636154 | high | inside | pin is in the middle of Baker Campground's site loops (inside the park, but campers-only) | baker-park-reserve-zoom.jpg |
| 118 | `alimagnet-park-disc-golf` | disc-golf | 622 m | 44.739731, -93.245231 | low | no | pin is on the main park road beside the ball-field complex in the N part of the park, ~620 m NW | alimagnet-park-disc-golf-zoom.jpg |
| 119 | `franklin-steele-square-splash-pad` | splash-pad | 591 m | 44.967002, -93.268349 | high |  | pin is on a residential block SOUTH of I-94, ~590 m from the square (the freeway lies between) | franklin-steele-square-splash-pad-zoom.jpg |
| 120 | `high-bridge-off-leash-dog-park` ᵖ | dog-park | 588 m | 44.934042, -93.108171 | medium | no | pin sits in an office park on the river flats ~0.6 km SW (between the office buildings W of the gas-fired High Bridge… | high-bridge-off-leash-dog-park-zoom.jpg |
| 121 | `victory-prairie-off-leash-dog-park` | dog-park | 580 m | 45.040207, -93.312715 | medium | no | pin sits at the Osseo Rd / 44th-45th Ave N / Penn corner by a gas station, just S of Victory Memorial Pkwy, ~0.6 km SSE | victory-prairie-off-leash-dog-park-zoom.jpg |
| 122 | `margaret-park-sledding-hill` ᵖ | sledding | 560 m | 44.961730, -93.055111 | low |  | pin is mid-block in houses ~0.5 km E of the park, not in any park | margaret-park-sledding-hill-zoom.jpg |
| 123 | `como-park-sledding-hill` ᵖ | sledding | 553 m | 44.984857, -93.146554 | low |  | pin is on a house row at the NW edge of Como golf course, ~550 m NW of the clubhouse | como-park-sledding-hill-zoom.jpg |
| 124 | `boom-island-park` ᵖ | park | 545 m | 44.992910, -93.269815 | medium | inside | pin is on a small lot/plaza at the park's far E end by Main St, opposite the N tip of Nicollet Island | boom-island-park-zoom.jpg |
| 125 | `bde-maka-ska-north-beach` | beach | 544 m | 44.949036, -93.314101 | high |  | pin is on the wooded strip/lagoon between Lake of the Isles and Bde Maka Ska, N of the parkway bridge | bde-maka-ska-north-beach-zoom.jpg |
| 126 | `lilydale-regional-park` ᵖ | park | 530 m | 44.919368, -93.122761 | high | no | pin is on the SE shore of Pickerel Lake at the railroad below the West Side bluff, across the lake from every park road… | lilydale-regional-park-zoom.jpg |
| 127 | `lake-ann-park-beach` ᵖ | beach | 504 m | 44.868411, -93.558543 | low |  | pin is in woods by the park entrance road off W 78th St / Hwy 5, ~500 m S of the lake | lake-ann-park-beach-zoom.jpg |
| 128 | `point-douglas-park-beach` ᵖ | beach | 502 m | 44.750054, -92.812680 | high |  | pin is in the Mississippi River channel S of the highway and rail line, ~500 m SE of the beach (and on the wrong river:… | point-douglas-park-beach-zoom.jpg |
| 129 | `blaine-lochness-disc-golf` ᵖ | disc-golf | 500 m | 45.174078, -93.156234 | low | no | pin is in wooded private lots (houses, a pond) just E of Lexington Ave, ~500 m NW of the course and apparently outside… | blaine-lochness-disc-golf-zoom.jpg |
| 130 | `elm-creek-dog-off-leash-area` | dog-park | 499 m | 45.168518, -93.421298 | medium | no | pin sits in a large open clearing in the woods ~0.5 km NE of the lot, on the far side of the paved trail loop, so very… | elm-creek-dog-off-leash-area-zoom.jpg |
| 131 | `dakota-park-dog-park` ᵖ | dog-park | 498 m | 44.955550, -93.358295 | low | no | Pin is in a residential grid ~500 m east, west of Hwy 100 | dakota-park-dog-park-zoom.jpg |
| 132 | `phalen-beach-splash-pad` | splash-pad | 468 m | 44.983058, -93.054327 | medium |  | pin is on a residential block S of Phalen Regional Park, ~470 m SW of the beach | phalen-beach-splash-pad-zoom.jpg |
| 133 | `mississippi-gateway-regional-park` | park | 465 m | 45.140209, -93.314009 | high | no | pin is ON THE COON RAPIDS DAM spillway, mid-river (the dam walkway is a park trail, so borderline, but it's water, not… | mississippi-gateway-regional-park-zoom.jpg |
| 134 | `rosemount-central-park-splash-pad` | splash-pad | 460 m | 44.740777, -93.123687 | medium |  | pin is on a residential block W of downtown Rosemount, ~460 m SW of Central Park | rosemount-central-park-splash-pad-zoom.jpg |
| 135 | `currie-park-splash-pad` | splash-pad | 458 m | 44.970121, -93.250709 | medium |  | pin is on a residential block E of Cedar Ave S of Washington Ave, ~460 m E of Currie Park | currie-park-splash-pad-zoom.jpg |
| 136 | `lake-minnewashta-regional-beach` ᵖ | beach | 457 m | 44.882306, -93.602552 | high |  | pin is in open water ~250 m off the park E shore, ~450 m SW of the beach | lake-minnewashta-regional-beach-zoom.jpg |
| 137 | `conway-park-splash-pad` | splash-pad | 448 m | 44.954973, -93.011925 | low |  | pin is in woods between apartment buildings ~450 m W of the park (not in the park) | conway-park-splash-pad-zoom.jpg |
| 138 | `tony-schmidt-lake-johanna-beach` | beach | 447 m | 45.047453, -93.175982 | high |  | pin is on houses along Lake Johanna Blvd on the W shore, outside the park | tony-schmidt-lake-johanna-beach-zoom.jpg |
| 139 | `thresher-fields-off-leash-dog-area` | dog-park | 444 m | 44.837638, -93.123905 | high | no | Pin is on the park entrance road along the lake, NW of the lot, outside the dog area | thresher-fields-off-leash-dog-area-zoom.jpg |
| 140 | `rivertown-dog-park` | dog-park | 430 m | 44.736030, -92.839371 | medium | no | Pin is on 10th St E in front of the large factory W of the church, ~430 m W | rivertown-dog-park-zoom.jpg |
| 141 | `phalen-regional-park-beach` | beach | 420 m | 44.983040, -93.053817 | high |  | pin is in residential blocks S of the park (outside Phalen Regional Park), ~400 m SW of the beach | phalen-regional-park-beach-zoom.jpg |
| 142 | `richardson-nature-center` ᵖ | nature-center | 420 m | 44.843000, -93.370679 | high |  | pin is in a residential street W of East Bush Lake Rd, across the road from the park | richardson-nature-center-zoom.jpg |
| 143 | `lake-of-the-isles-off-leash-dog-park` | dog-park | 418 m | 44.951072, -93.308898 | high | no | pin sits in open water in the middle of Lake of the Isles, between the two islands | lake-of-the-isles-off-leash-dog-park-zoom.jpg |
| 144 | `coon-lake-county-beach` | beach | 414 m | 45.322540, -93.132398 | high |  | pin is on 197th Ave NE (the park address point on the road), ~400 m N of the beach | coon-lake-county-beach-zoom.jpg |
| 145 | `lowertown-off-leash-dog-park` | dog-park | 407 m | 44.951533, -93.082353 | medium | no | pin sits on 4th St E at the Union Depot / Broadway corner in Lowertown, ~0.4 km SSW and S of CHS Field | lowertown-off-leash-dog-park-zoom.jpg |
| 146 | `shakopee-lions-disc-golf` | disc-golf | 386 m | 44.782726, -93.539127 | medium | no | pin is on Marystown Rd/Adams St at the park entrance drive, N of the aquatic center | shakopee-lions-disc-golf-zoom.jpg |
| 147 | `bassett-creek-dog-park` ᵖ | dog-park | 383 m | 45.011101, -93.356297 | medium | no | Pin is in a residential block west of the park, across the main N-S road | bassett-creek-dog-park-zoom.jpg |
| 148 | `pioneer-park-splash-pad` | splash-pad | 380 m | 45.029300, -93.086501 | low |  | pin is on Centerville Rd at the park E edge by a small lot, ~380 m E of the play complex on the W side by the main lot | pioneer-park-splash-pad-zoom.jpg |
| 149 | `ritter-farm-dog-park` | dog-park | 379 m | 44.667374, -93.296928 | low | no | Pin is on the gravel park road between two ponds in the middle of Ritter Farm Park | ritter-farm-dog-park-zoom.jpg |
| 150 | `schulze-lake-beach` | beach | 370 m | 44.785001, -93.127520 | high |  | pin is in the middle of the lake N of the visitor centre (not Schulze Lake), ~370 m N of the beach | schulze-lake-beach-zoom.jpg |
| 151 | `greenwood-shores-beach` ᵖ | beach | 368 m | 44.874306, -93.556127 | medium |  | pin is in open water in the middle of Lake Ann E basin | greenwood-shores-beach-zoom.jpg |
| 152 | `bde-maka-ska-thomas-beach` | beach | 358 m | 44.936030, -93.315919 | high |  | pin is in open water mid-lake, ~300 m N of the S shore | bde-maka-ska-thomas-beach-zoom.jpg |
| 153 | `bush-lake-beach` | beach | 353 m | 44.837322, -93.379947 | high |  | pin is on E Bush Lake Rd itself, N of the beach access road, ~350 m ENE of the sand | bush-lake-beach-zoom.jpg |
| 154 | `eagan-central-park-splash-pad` | splash-pad | 336 m | 44.840616, -93.174337 | high |  | pin is in the woods SE of the Eagan Community Center (between the building and the pond), ~340 m from the pad | eagan-central-park-splash-pad-zoom.jpg |
| 155 | `william-obrien-state-park` ᵖ | park | 333 m | 45.222907, -92.768036 | high | inside | pin is on the park entrance road at the ranger station just W of Hwy 95 (the DNR's own directions: 'ranger station… | william-obrien-state-park-zoom.jpg |
| 156 | `phalen-regional-park` | park | 331 m | 44.989617, -93.057231 | medium | inside | pin is on the park road/lot at the Keller Creek channel by the footbridge to the picnic-shelter island, inside the park | phalen-regional-park-zoom.jpg |
| 157 | `roundhouse-park-beach` | beach | 324 m | 44.879187, -93.620065 | low |  | pin is on Kings Rd at the W edge of Roundhouse Park (tennis courts/fields), ~300 m W of the lake | roundhouse-park-beach-zoom.jpg |
| 158 | `manor-park-splash-pad` | splash-pad | 309 m | 45.012911, -93.323034 | medium |  | pin is on a residential block ~310 m SW of the park | manor-park-splash-pad-zoom.jpg |
| 159 | `fort-snelling-state-park` ᵖ | park | 285 m | 44.891068, -93.182384 | high | no | pin is on the parade ground of Historic Fort Snelling (MNHS site), which the DNR summer map shades grey as non-park… | fort-snelling-state-park-zoom.jpg |
| 160 | `oak-hill-park-splash-pad` | splash-pad | 285 m | 44.942808, -93.377201 | high |  | pin is on Rhode Island Ave at the north wooded end of the park, ~285 m N of the pad | oak-hill-park-splash-pad-zoom.jpg |
| 161 | `lions-park-splash-pad` | splash-pad | 280 m | 44.783903, -93.538855 | high |  | pin is on the park entrance at the main N-S road (park drive junction), ~280 m NW of the pad | lions-park-splash-pad-zoom.jpg |
| 162 | `battle-creek-off-leash-dog-area` | dog-park | 278 m | 44.939881, -93.001580 | medium |  | pin sits on the edge of a pond in the wooded middle of Battle Creek Regional Park, ~280 m S of the lot | battle-creek-off-leash-dog-area-zoom.jpg |
| 163 | `gearty-park-off-leash-pet-area` ᵖ | dog-park | 269 m | 44.997590, -93.344708 | high | no | Pin is in house backyards north of the curving main road | gearty-park-off-leash-pet-area-zoom.jpg |
| 164 | `cologne-city-square-splash-pad` | splash-pad | 267 m | 44.770311, -93.782857 | high |  | pin is on the open marsh-edge field W of town by the small pond, ~270 m W of the square | cologne-city-square-splash-pad-zoom.jpg |
| 165 | `homeward-hills-splash-pad` | splash-pad | 264 m | 44.822460, -93.432177 | medium |  | pin is on Silverwood Dr at the park S entrance trail, ~265 m SE of the park building cluster | homeward-hills-splash-pad-zoom.jpg |
| 166 | `lake-harriet-southeast-beach` | beach | 260 m | 44.917086, -93.300597 | high |  | pin is in open water ~200 m NW of the SE shore | lake-harriet-southeast-beach-zoom.jpg |
| 167 | `lake-harriet-north-beach` | beach | 258 m | 44.928375, -93.304098 | medium |  | pin is in open water ~150 m off the N shore | lake-harriet-north-beach-zoom.jpg |
| 168 | `gateway-off-leash-dog-park` | dog-park | 256 m | 44.971232, -93.268721 | low | no | pin sits on the roof of the round church building (Central Lutheran) beside the I-35W ramps | gateway-off-leash-dog-park-zoom.jpg |
| 169 | `battle-creek-sledding-hill` ᵖ | sledding | 241 m | 44.937820, -93.013048 | low |  | pin is on the N-S street (Winthrop St) E of the rec-center lot and pond, on the park edge | battle-creek-sledding-hill-zoom.jpg |
| 170 | `woodbury-sports-center-splash-pad` | splash-pad | 239 m | 44.887507, -92.938695 | medium |  | pin is on the open lawn W of the main parking lot, ~240 m from the pad | woodbury-sports-center-splash-pad-zoom.jpg |
| 171 | `bryant-lake-disc-golf` | disc-golf | 237 m | 44.883866, -93.429861 | low | no | pin is on the beach bathhouse/pavilion beside the swimming beach lot | bryant-lake-disc-golf-zoom.jpg |
| 172 | `mississippi-gateway-splash-pad` | splash-pad | 237 m | 45.140318, -93.312379 | low |  | pin is on West River Rd at the park entrance intersection, W of the main lot | mississippi-gateway-splash-pad-zoom.jpg |
| 173 | `bottineau-field-splash-pad` | splash-pad | 233 m | 45.000015, -93.253052 | high |  | pin sits on residential houses a block west of the park | bottineau-field-splash-pad-zoom.jpg |
| 174 | `round-lake-park-splash-pad` | splash-pad | 233 m | 44.867926, -93.489721 | high |  | pin is on Valley View Rd beside the school campus N of the park, ~230 m from the pad | round-lake-park-splash-pad-zoom.jpg |
| 175 | `lake-hiawatha-beach` | beach | 232 m | 44.921134, -93.233091 | high |  | pin is on the Lake Hiawatha Park rec center building (2701 E 44th St address point) | lake-hiawatha-beach-zoom.jpg |
| 176 | `lake-waconia-regional-beach` | beach | 226 m | 44.855637, -93.764137 | high |  | pin is on the park entrance road at the roundabout by a stormwater pond, ~225 m SE of the sand | lake-waconia-regional-beach-zoom.jpg |
| 177 | `gold-medal-park` ᵖ | park | 226 m | 44.977764, -93.253333 | high | no | pin is on Washington Ave S among downtown buildings, one block SW of the park (S of the Guthrie), outside it | gold-medal-park-zoom.jpg |
| 178 | `lake-nokomis-main-beach` | beach | 224 m | 44.912133, -93.242435 | high |  | pin on the ball fields W of Lake Nokomis Pkwy | lake-nokomis-main-beach-zoom.jpg |
| 179 | `belwin-conservancy` | nature-center | 212 m | 44.925546, -92.800173 | low |  | pin sits in unbroken woods E of the N-S road (taken as Stagecoach Trail), with no building under it | belwin-conservancy-zoom.jpg |
| 180 | `bde-maka-ska-32nd-street-beach` | beach | 202 m | 44.944796, -93.305119 | high |  | pin is in the water ~100 m off the E shore at about W 33rd St, one block S of the beach | bde-maka-ska-32nd-street-beach-zoom.jpg |
| 181 | `loring-park-off-leash-dog-park` | dog-park | 201 m | 44.971925, -93.284036 | low | no | pin sits in the middle of Loring Park, on the plaza/circle between the two ponds | loring-park-off-leash-dog-park-zoom.jpg |
| 182 | `becker-park-splash-pad` | splash-pad | 199 m | 45.053718, -93.360228 | medium |  | pin is on the street between apartment blocks S of the park, ~200 m S of the pad | becker-park-splash-pad-zoom.jpg |
| 183 | `merriam-park-sledding-hill` ᵖ | sledding | 198 m | 44.951743, -93.184777 | low |  | pin is on the I-94 travel lanes just N of the park (and the Rec Center), not in the park | merriam-park-sledding-hill-zoom.jpg |
| 184 | `como-regional-park` ᵖ | park | 191 m | 44.981416, -93.152286 | medium | inside | pin sits on the road/path just NE of the conservatory by the Japanese garden, inside the park | como-regional-park-zoom.jpg |
| 185 | `wood-lake-nature-center` | nature-center | 183 m | 44.881048, -93.290152 | high |  | pin sits at the 66th St / Lake Shore Dr junction at the woods' N edge, ~180 m NW of the building | wood-lake-nature-center-zoom.jpg |
| 186 | `eagan-northview-disc-golf` ᵖ | disc-golf | 169 m | 44.803078, -93.153481 | low | no | pin is on the E shoreline of the lake (in the water's edge), just W of the wooded park | eagan-northview-disc-golf-zoom.jpg |
| 187 | `wintercrest-park-disc-golf` | disc-golf | 166 m | 45.159782, -93.286371 | low | no | pin is on the curving road at the NW corner of the park by a townhouse street | wintercrest-park-disc-golf-zoom.jpg |
| 188 | `harmon-park-splash-pad` | splash-pad | 163 m | 44.915837, -93.095290 | high |  | pin is on the infield of the NE ball diamond, ~160 m SE of the pad at the park NW corner | harmon-park-splash-pad-zoom.jpg |
| 189 | `southbridge-off-leash-dog-park` | dog-park | 162 m | 44.780002, -93.428405 | high | no | Pin is on Southbridge Pkwy (median/road edge) S of the park | southbridge-off-leash-dog-park-zoom.jpg |
| 190 | `bandimere-heights-disc-golf` | disc-golf | 158 m | 44.836050, -93.534705 | low |  | pin is on the central parking loop of Bandimere COMMUNITY Park (9405 Great Plains Blvd) | bandimere-heights-disc-golf-zoom.jpg |
| 191 | `maple-grove-central-park-splash-pad` | splash-pad | 157 m | 45.102240, -93.432514 | high |  | pin is on the street-side parking lot SW of the pavilion | maple-grove-central-park-splash-pad-zoom.jpg |

## Not found (14)

Why each one could not be placed. "Postdates the photo" rows need newer imagery or a visit; the others need the park's own map or a registry decision.

| Entry | Kind | Why not found | Crop |
|---|---|---|---|
| `woodview-off-leash-dog-area` | dog-park | not located; listings put it at 481 Larpenteur Ave W, south side of Reservoir Woods, lot off Larpenteur | woodview-off-leash-dog-area-loc.jpg |
| `bunker-hills-dog-park` | dog-park | not located; the Bunker Hills compost site (Hanson Blvd at the S edge of Bunker Hills park) was found, the dog area beside it was not | bunker-hills-dog-park-loc.jpg |
| `alimagnet-dog-park` | dog-park | not located: 7-acre enclosed wooded dog park with a walking path around a stormwater pond (city page) | alimagnet-dog-park-loc.jpg |
| `blaine-wetland-sanctuary` | nature-center | Blaine Wetland Sanctuary Lexington Ave trailhead lot (not found) | blaine-wetland-sanctuary-zoom.jpg |
| `roseville-central-park-sledding-hill` | sledding | no sledding hill identifiable or attested in Central Park-Lexington | roseville-central-park-sledding-hill-loc.jpg |
| `victory-memorial-splash-pad` | splash-pad | pad not in the photo: MPRB says the splash pad replacing the wading pool was completed spring 2025; April 2025 shows a construction-fenced zone W of Loring Elementary (approx 45.036060,-93.314246, 153 m from pin) | victory-memorial-splash-pad-zoom.jpg |
| `grand-prairie-park-splash-pad` | splash-pad | not in photo: Lakeville says park construction was completed in 2026, so the pad postdates the April 2025 photo | grand-prairie-park-splash-pad-loc.jpg |
| `boulevard-plaza-splash-pad` | splash-pad | not located: plaza is on the Coon Rapids Ice Center grounds (opened by May 2024, so it should be in the photo) but I could not identify the ice center on the met25 photo | boulevard-plaza-splash-pad-loc.jpg |
| `heritage-village-splash-pad` | splash-pad | not in photo: the inclusive splash pad + playground are phase 5 of the master plan (funding June 2023, resident feedback March 2024); nothing like them is in the April 2025 photo | heritage-village-splash-pad-loc.jpg |
| `chanhassen-city-center-splash-pad` | splash-pad | not in photo: the splash fountain is part of Civic Campus Phase 2 (construction from July 2025, done 2026), built N of the new City Hall | chanhassen-city-center-splash-pad-loc.jpg |
| `fridley-commons-park-splash-pad` | splash-pad | not in photo: Fridley says the S-half redevelopment with the splash pad was completed 2026 (park reopened 12 Jun 2026) | fridley-commons-park-splash-pad-loc.jpg |
| `ramsey-waterfront-splash-pad` | splash-pad | not located: The Waterfront sits across Sunwood Dr from Ramsey City Hall in the COR town centre; a Feb 2026 contractor packet schedules splash-pad piping for spring 2026, so the pad likely postdates the April 2025 photo | ramsey-waterfront-splash-pad-loc.jpg |
| `zanewood-splash-pad` | splash-pad | no splash pad found: the sourceUrl is the Summer Splash EVENT page (water inflatables at Zanewood Rec Center, 7150 Zane Ave N); searches found no permanent splash pad at Zanewood | zanewood-splash-pad-loc.jpg |
| `shoreview-commons-splash-pad` | splash-pad | no outdoor splash pad found: the city playground page lists only a drinking fountain; the draft master plan lists a POSSIBLE splash pad near the destination playground (not adopted). The water play that exists is the… | shoreview-commons-splash-pad-loc.jpg |

## Within 150 m (30)

`lake-nokomis-park` 149 m · `zachary-playfield-disc-golf` 145 m · `new-brighton-lions-park-splash-pad` 138 m · `cedarcrest-park-splash-pad` 136 m · `bassett-creek-park-disc-golf` 130 m · `mounds-view-splash-down` 125 m · `gateway-center-mississippi-gateway` 123 m · `andrews-park-splash-pad` 119 m · `richfield-splash-pad` 113 m · `lagoon-park-splash-pad` 107 m · `savage-dog-park` 102 m · `elm-creek-disc-golf` 101 m · `nesbitt-preserve-splash-pad` 95 m · `heritage-village-off-leash-dog-park` 92 m · `burnes-park-splash-pad` 92 m · `wag-farms-dog-park` 85 m · `minnehaha-regional-park` 84 m · `phelps-field-splash-pad` 75 m · `parque-castillo-splash-pad` 75 m · `chaska-firemens-park-splash-pad` 74 m · `oakwood-park-disc-golf` 71 m · `oakdale-bark-park` 70 m · `hyland-hills-disc-golf` 67 m · `roy-wilkins-splash-pad` 65 m · `plymouth-creek-playfield-disc-golf` 47 m · `wayzata-panoway-splash-pad` 47 m · `french-regional-sledding-hill` 45 m · `andys-bark-park` 38 m · `tamarack-disc-golf-woodbury` 26 m · `nicollet-commons-splash-pad` 16 m
