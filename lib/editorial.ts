/**
 * EDITORIAL INTROS (roadmap 3.2) — real sentences on the money pages.
 *
 * Internal links are the cheapest ranking signal; actual paragraphs are the
 * second cheapest. These render on venue and neighborhood pages, above the
 * event lists. Two-to-three sentences, concrete over promotional, written
 * the way a local would explain a place to a friend from out of town.
 *
 * Keys are venue-page slugs and neighborhood keys — a drift-guard test
 * asserts every key resolves against the live registries, so an intro can
 * never point at a page that doesn't exist. Venues without an intro simply
 * don't render one; there's no obligation to cover all 42.
 *
 * Editing: plain strings, edit freely. Keep them short. If it sounds like a
 * brochure, cut the sentence.
 */

/**
 * PLACES kind-page header paragraphs (Places roadmap P1.2). Keyed by PlaceKind.
 * Same rules as the intros below — 2–3 concrete sentences, edit freely; a kind
 * without one falls back to its KIND_META blurb.
 */
export const PLACES_KIND_INTRO: Record<string, string> = {
  beach:
    "Minneapolis alone keeps a dozen guarded lake beaches, and the water's swimmable from Memorial Day to Labor Day. Lifeguards work the afternoons in summer; the sand stays open dawn to dark either way. After a hard rain, check the park board's water-quality map before you load the car.",
  "splash-pad":
    "When it's too hot for the playground and you're not driving to a lake, a splash pad is the move — free, no admission, just cold water on a timer. The metro's are tucked into the neighborhood parks; most run late May into September and shut off at night.",
  pool:
    "For actual laps, a real diving board, or a waterslide the kids will make you ride twice, the metro's aquatic centers deliver. Most outdoor pools run June through August for a daily fee; a couple of indoor water parks keep going all winter.",
  park:
    "The parks worth crossing town for — the falls at Minnehaha, the conservatory at Como, the reserves with real wilderness on the metro's edge. Most are free and open dawn to dark, year-round.",
  playground:
    "The destination playgrounds — the award-winning creative structures and the fully inclusive parks built for kids of every ability. Free, and worth the drive when the neighborhood swing set won't cut it.",
  rink:
    "Free neighborhood rinks, the world's biggest refrigerated oval, and a canal you can skate for a quarter-mile — winter turns the metro into a skating town. Most outdoor ice runs December through February, weather permitting; the indoor sheets keep going year-round.",
  sledding:
    "The hills worth hauling the toboggan to — the steep ones, the long ones, the one with the yearly art-sled rally. All free, all bring-your-own-sled, all at your own risk, from the first real snow through February.",
  "golf-course":
    "Every public course you can just book a tee time at — the city munis, the daily-fee tracks, and the quick par-3s. Greens fees vary; most open in April and play into October, weather willing. Private members-only clubs aren't here — only where anyone can walk on.",
  "farmers-market":
    "Where the metro's growers and makers set up each week — sweet corn and tomatoes in August, greens and rhubarb in June, honey and crafts right through fall. Most run May to October, one morning or evening a week; a few flagships keep an indoor winter market going. Bring cash, though many now take cards and SNAP/EBT.",
  "dog-park":
    "Off-leash areas across the metro, from small fenced neighborhood runs to the big regional romps with lake access and room to actually sprint. Most city parks are free; the Minneapolis, St. Paul, and Three Rivers areas want a permit — annual or daily. Open year-round, snow or shine.",
  "disc-golf":
    "Public disc golf across the metro — most are free 18-hole park courses you can just walk on, plus a handful of pay-to-play wooded tracks. Bring your own discs; peak season is spring through fall, but the diehards play right through the snow. Weekends and evenings fill up on the popular ones.",
  "nature-center":
    "The metro's nature centers — miles of trails, hands-on exhibits, and naturalist programs, most of them free. Open year-round; the grounds stay open dawn to dusk even when the interpretive building keeps shorter hours. A solid rainy-day or first-snow outing with kids.",
  "garden":
    "Botanical gardens and conservatories across the metro — the glass houses that bloom all winter, the rose and Japanese gardens, and the Arboretum's sprawling grounds. Most are free; a couple charge. Peak color runs May through September, but the conservatories are a green escape in January.",
  "ski-hill":
    "The metro's four downhill ski and snowboard hills — lifts, terrain parks, snowmaking, and rentals, all within a half-hour of the cities. The season runs roughly December into March, cold and snow permitting. All charge a lift ticket; the season passes pay off by February.",
};

export const VENUE_INTROS: Record<string, string> = {
  "first-avenue":
    "The black building with the silver stars, each one a name that's played here since 1970 — Prince's is painted gold. The Mainroom holds about 1,500 and the sound is better than it has any right to be; the 7th St Entry next door is a 250-cap box where you'll catch bands two years before they're on the Mainroom marquee.",
  "palace-theatre":
    "A 1916 vaudeville house that sat empty for four decades until St. Paul reopened it in 2017, ceiling left artfully half-crumbled. Mostly standing room, which the touring acts seem to feed off. Grab the rail on the mezzanine if your knees have opinions.",
  "armory":
    "An actual 1930s military armory that now does 8,000-cap shows a few blocks from U.S. Bank Stadium. It's a big concrete room and sounds like one, but the sightlines are honest and the load-in-to-Lyft walk is short.",
  "turf-club":
    "A Midway rock room that's been pouring since before your parents met, with a low ceiling, a good jukebox, and the Clown Lounge lurking in the basement when it's open. Bands play loud and close. Cash for the tip jar doesn't hurt.",
  "icehouse":
    "Eat Street's jazz-and-everything-else room — experimental one night, hip-hop the next, and a brunch that has its own following. Small enough that the drummer can hear your conversation, so maybe don't.",
  "cedar-cultural-center":
    "A West Bank institution that books the planet: Malian guitarists, Nordic fiddle bands, Somali pop, whoever's touring that no one else in town would think to book. All-ages, volunteer-run at the edges, and the floor's usually a mix of folding chairs and dancing.",
  "dakota-jazz-club":
    "Supper-club jazz on Nicollet Mall — tables, low light, a kitchen that takes itself seriously, and a booking calendar that swings from legends to left-field soul. Sit close; the room was built for it.",
  "fine-line":
    "A two-level Warehouse District club that's been a first-Minneapolis-show rite of passage for thirty years. The balcony wraps the floor, so short people have options.",
  "varsity-theater":
    "Dinkytown's old movie house turned club, chandeliers and couches included. It's a strange, pretty room, and the U of M crowd keeps the energy up on weeknights other venues would write off.",
  "fillmore-minneapolis":
    "The corporate-shiny newcomer by Target Field — but the sound system is genuinely excellent and the floor was designed by people who'd stood in bad rooms before. Shows here end near a dozen decent bars.",
  "xcel-energy-center":
    "Downtown St. Paul's arena, home ice for the Wild and the biggest touring shows that come through the east metro. Locals still argue it beats the Minneapolis arenas on sightlines. Park once in the ramp and you're a block from Rice Park.",
  "target-center":
    "Wolves and Lynx basketball plus arena tours, right on First Avenue's block — literally; the club is across the street, which makes for good before-and-after. Skyway-connected for January shows.",
  "orchestra-hall":
    "The Minnesota Orchestra's home on Nicollet, with the famous cube-studded ceiling doing real acoustic work. Rush tickets and casual-dress crowds have made it a lot less stuffy than the exterior suggests.",
  "surly-brewing-festival-field":
    "Outdoor summer shows on the lawn next to Surly's beer hall in Prospect Park. The formula's simple: band, sunset, a Furious in a compostable cup. Bring a layer; it's Minnesota.",
  "paisley-park":
    "Prince's studio complex in Chanhassen, kept close to how he left it. Tours and the occasional event; phones get locked in pouches at the door, and honestly the place is better for it.",
  "como-park-zoo-and-conservatory":
    "Free, open year-round, and the reason half the metro survived February: the Conservatory's Sunken Garden stays green and 75 degrees no matter what's happening outside. The zoo side is small, walkable, and exactly the right size for kids under eight.",
  "lake-harriet-bandshell":
    "Free concerts by the lake most summer nights, an institution that runs on ice cream from the adjacent stand and people arriving by canoe. Bring a blanket; the benches go early.",
};

export const NEIGHBORHOOD_INTROS: Record<string, string> = {
  "downtown-minneapolis":
    "The theaters cluster on Hennepin — Orpheum, State, Pantages — with Orchestra Hall and the arenas a few blocks off, all stitched together by the skyways, which you will come to understand around mid-January. Most shows land within a ten-minute walk of each other.",
  "north-loop":
    "Warehouses turned into restaurants, Target Field wedged in the middle, and the Fillmore holding down the music end. Game nights change the whole neighborhood's temperature. Everything's walkable from the ballpark ramps.",
  "northeast":
    "Old Nordeast: church steeples, corner bars with Grain Belt signs, and more working artist studios than anywhere else in the state — Art-A-Whirl in May is the proof. The brewery density along Central and 13th is either a feature or a hazard depending on your evening.",
  "uptown":
    "The Hennepin-and-Lake blocks have been reinventing themselves for a few years now, but the bones are unchanged: the lakes two blocks west, small stages and comedy rooms in the storefronts, and summer nights when the whole area moves on bike wheels.",
  "loring-park":
    "The Walker and its Sculpture Garden — yes, the spoon and the cherry — face the park across a footbridge, with Loring's own loop of pond, dogs, and porch-y restaurants below. Pride takes the whole park over in June.",
  "whittier-eat-street":
    "Nicollet between downtown and Lake is Eat Street: Vietnamese, Mexican, Greek, Ethiopian, sometimes all on one block, with Mia — free, enormous — anchoring the east side. Icehouse gives the strip its late-night soundtrack.",
  "dinkytown-u-of-m":
    "The U's front porch. Dylan played the coffeehouses here before he was Dylan, the Varsity still runs shows under its chandeliers, and everything is priced for students, which works out fine for everyone else.",
  "south-minneapolis":
    "A grid of parks, porches, and neighborhood main streets — 48th & Chicago, 38th Street, the Parkway Theater doing movies and odd little shows. Less a destination than a place where things keep quietly happening.",
  "southwest-lakes":
    "Harriet, Bde Maka Ska, and the chain trails connecting them — the bandshell's free summer concerts are the anchor event, and the whole area operates at bike speed from May to October.",
  "minnehaha":
    "The falls are the postcard, 53 feet of them, with Sea Salt's fish tacos at the top and miles of creek trail running west. Longfellow's bars and the Hook and Ladder sit close enough to make a full day of it.",
  "downtown-st-paul":
    "Rice Park with the Ordway on one side and the Palace two blocks up, Xcel looming for Wild games and arena tours, and Lowertown behind it all — artists' lofts, the farmers market on weekends, and CHS Field, where a Saints game remains the best cheap night out in either city.",
  "cathedral-hill":
    "The Cathedral on its hill, then Summit Avenue running west past the longest stretch of intact Victorian mansions in the country. F. Scott Fitzgerald grew up around the corner and complained about it beautifully.",
  "grand-avenue":
    "St. Paul's shopping-and-supper street, a straight shot of local storefronts between the river bluff and the mansions. Grand Old Day, when it happens, closes the whole thing for one long block party.",
  "midway-hamline":
    "Allianz Field's see-through Wonderwall glowing on Snelling changed the neighborhood's skyline; the Turf Club, a block away, refuses to change at all. That contrast is basically the whole Midway.",
  "como":
    "The zoo and Conservatory are free, the lakeside pavilion does summer concerts with paddleboats drifting past, and the whole park absorbs weekend crowds without ever quite feeling full.",
  "highland-park":
    "A leafy village-in-the-city on St. Paul's southwest corner — the 1930s Highland Theater sign, a walkable spine of shops on Cleveland and Ford Parkway, and the river gorge trails a few blocks west.",
};

/**
 * /for-venues copy (roadmap 4.4). Plain strings, edit freely — this page is
 * a promise to venues, so Taren's wording wins. If it sounds like a
 * brochure, cut the sentence.
 */
export const FOR_VENUES = {
  tagline: "Get your events listed — free. That is the whole pitch.",
  how: "Every Monday, a research sweep reads venue calendars across the metro — First Avenue to the Cedar, church festivals to county fairs — and publishes what it finds. Thursdays, a verify pass checks facts against sources. If your room posts its calendar publicly, odds are we already list you.",
  qualifies: "Public events in the Minneapolis–St. Paul metro with a real date, a real place, and a way for someone to show up. Concerts, games, markets, festivals, exhibitions, the wonderfully unique. Private parties, webinars, and pitch nights don't fit.",
  missing: "Something missing or wrong — a show we haven't caught, a date that moved? Submit it and we'll take a look. Most submissions are reviewed within the week.",
  rules: "Listing is free and stays free. Placement can't be bought: no pay-to-list, no pay-to-rank, ever. The calendar is chronological — what's on top is whatever happens next, not whoever paid.",
};
