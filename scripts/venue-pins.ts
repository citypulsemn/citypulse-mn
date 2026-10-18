/**
 * Find rooms whose map pins disagree, settle each one, and sync its listings.
 *
 *   npm run pins                                      audit + resolve, writes nothing
 *   npm run pins -- --apply --backup=before.json      write venue_coords and sync events
 *   npm run pins -- --room="dakota jazz club"         one room only
 *   npm run pins -- --threshold=250                   tighter disagreement bar
 *
 * Two independent geocoders, both free and keyless: OpenStreetMap Nominatim and
 * US Census TIGER. A room is settled only when they land within AGREE_METRES of
 * each other — one geocoder is a question, two agreeing is a finding. A room
 * they cannot settle is REPORTED AND LEFT ALONE; this script never writes a pin
 * it cannot attest, which is the whole reason the old per-event geocode was
 * wrong.
 *
 * Mapbox is deliberately not used here. It is what produced the bad pins (it
 * answers a house-numbered street address with a street centroid rather than
 * failing), and on this machine there is no MAPBOX_GEOCODING_TOKEN anyway.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import { distanceMeters } from "../lib/geo-distance";
import {
  agreeingPin,
  groupByRoom,
  distinctPins,
  pinSpreadMetres,
  roomDisagrees,
  usableAddresses,
  DISAGREE_METRES,
  type Hit,
} from "../lib/venue-pins";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const threshold = Number(arg("threshold") ?? DISAGREE_METRES) || DISAGREE_METRES;
const onlyRoom = arg("room");
const hinted = arg("address");
const CACHE = arg("cache") ?? "venue-pin-cache.json";

if (hinted && !onlyRoom) {
  console.error('[pins] ✗ --address= only makes sense with --room="<room key>"');
  process.exit(2);
}

for (const [flag, envKey] of [
  ["--apply", "npm_config_apply"],
  ["--backup", "npm_config_backup"],
  ["--room", "npm_config_room"],
  ["--address", "npm_config_address"],
  ["--threshold", "npm_config_threshold"],
] as const) {
  if (process.env[envKey] && !process.argv.some((a) => a.startsWith(flag))) {
    console.error(`[pins] ✗ npm swallowed ${flag}. Use: npm run pins -- ${flag}=...`);
    process.exit(2);
  }
}

const UA = "citypulse-mn/1.0 (venue pin audit; https://www.citypulsemn.com)";
const cache: Record<string, Hit | null> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(CACHE, JSON.stringify(cache));

/** OpenStreetMap. Free, no key, ONE REQUEST A SECOND — hence the cache. */
async function nominatim(q: string): Promise<Hit | null> {
  const k = `nominatim:${q}`;
  if (k in cache) return cache[k];
  await sleep(1150);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    const j = res.ok ? ((await res.json()) as { lat: string; lon: string; display_name: string }[]) : [];
    cache[k] = j.length
      ? { provider: "nominatim", query: q, lat: Number(j[0].lat), lng: Number(j[0].lon), label: j[0].display_name }
      : null;
  } catch {
    cache[k] = null;
  }
  save();
  return cache[k];
}

/** US Census TIGER. Street addresses only — it will not resolve a venue NAME,
 *  which is exactly why it makes a good second opinion: it cannot be fooled by
 *  a name that happens to match somewhere else. */
async function census(q: string): Promise<Hit | null> {
  const k = `census:${q}`;
  if (k in cache) return cache[k];
  try {
    const url =
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` +
      `?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    const j = res.ok
      ? ((await res.json()) as {
          result?: { addressMatches?: { coordinates?: { x: number; y: number }; matchedAddress?: string }[] };
        })
      : {};
    const m = j.result?.addressMatches?.[0];
    cache[k] = m?.coordinates
      ? { provider: "census", query: q, lat: m.coordinates.y, lng: m.coordinates.x, label: m.matchedAddress }
      : null;
  } catch {
    cache[k] = null;
  }
  save();
  return cache[k];
}

interface Row {
  id: string;
  venue: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

async function main() {
  if (!sql) throw new Error("DATABASE_URL is required");

  const rows = await sql<Row[]>`
    select id::text as id, venue, city, address, lat::float as lat, lng::float as lng
    from events
    where status in ('published','draft') and lat is not null and lng is not null
  `;
  const known = new Map(
    (await sql<{ room_key: string; lat: number; lng: number; source: string }[]>`
      select room_key, lat::float as lat, lng::float as lng, source from venue_coords
    `).map((r) => [r.room_key, r]),
  );

  const rooms = [...groupByRoom(rows)]
    .filter(([key, evs]) => (onlyRoom ? key === onlyRoom : roomDisagrees(distinctPins(evs), threshold)))
    .sort((a, b) => b[1].length - a[1].length);

  console.log(
    `[pins] ${rooms.length} room(s) to settle, ${rooms.reduce((n, [, e]) => n + e.length, 0)} listing(s)` +
      `${apply ? "" : " — DRY RUN"}`,
  );
  if (rooms.length === 0) return void (await sql.end({ timeout: 5 }));

  if (arg("backup")) {
    const ids = new Set(rooms.flatMap(([, evs]) => evs.map((e) => e.id)));
    writeFileSync(arg("backup")!, JSON.stringify(rows.filter((r) => ids.has(r.id)), null, 1));
    console.log(`[pins] backed up ${ids.size} row(s) to ${arg("backup")}`);
  }

  let settled = 0;
  let unsettled = 0;
  let synced = 0;

  for (const [key, evs] of rooms) {
    const pins = distinctPins(evs);
    const venue = evs[0].venue.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const city = evs[0].city;
    console.log(
      `\n[pins] ${key} — ${evs.length} listing(s), ${pins.length} pin(s), ${pinSpreadMetres(pins)}m apart`,
    );

    const hits: Hit[] = [];
    const push = (h: Hit | null) => {
      if (h) hits.push(h);
    };
    // An address the OPERATOR read off the venue's own site, for the rooms our
    // own listings cannot settle. Two of fourteen needed this: the listings for
    // Downtown Anoka gave only cross-streets, and Dead End Hayride's gave
    // "Wyoming, MN (see website)". Supplying it does NOT bypass the agreement
    // rule — the address is still sent to both geocoders and still has to be
    // confirmed twice. The operator provides a fact, not a coordinate.
    if (hinted) {
      push(await nominatim(`${hinted}, ${city}, MN`));
      push(await census(`${hinted}, ${city}, MN`));
    }
    // The venue NAME first: it is the one query that cannot be ruined by an
    // agent's address spelling, and it is what resolved Grand Casino Arena,
    // CHS Field, Union Depot and the Science Museum.
    push(await nominatim(`${venue}, ${city}, MN`));
    for (const addr of usableAddresses(evs.map((e) => e.address)).slice(0, 2)) {
      push(await nominatim(`${addr}, ${city}, MN`));
      push(await census(`${addr}, ${city}, MN`));
    }
    for (const h of hits) {
      console.log(`[pins]    ${h.provider}("${h.query}") → ${h.lat},${h.lng}  ${(h.label ?? "").slice(0, 58)}`);
    }

    // A HINT OUTRANKS A TIGHTER MATCH. Duluth & Case is why: the city's own
    // page gives 1020 Duluth St, where the two providers landed 96m apart —
    // while "1030 Case Ave" from our own listings agreed to 3m and therefore
    // won. Tighter geocoder agreement says nothing about whether the ADDRESS is
    // right. The operator settles which address; the geocoders only settle
    // where that address is, and still have to agree to be believed.
    const hintedHits = hinted ? hits.filter((h) => h.query.startsWith(hinted)) : [];
    const agreed = (hintedHits.length > 1 ? agreeingPin(hintedHits) : null) ?? agreeingPin(hits);
    if (hinted && hintedHits.length > 1 && !agreeingPin(hintedHits)) {
      console.warn(
        `[pins] ⚠ the supplied address did not confirm twice — falling back to our own listings' addresses.`,
      );
    }
    if (!agreed) {
      // Rule 6. A room we cannot settle is named, not quietly skipped and not
      // given a pin from a single opinion.
      console.warn(
        `[pins] ⚠ NOT SETTLED — no two independent geocoders agree within 300m.\n` +
          `[pins]   Left exactly as it is. Read the venue's own site for its address and\n` +
          `[pins]   re-run with --room="${key}" once a listing carries it.`,
      );
      unsettled++;
      continue;
    }
    settled++;
    console.log(`[pins]  => ${agreed.lat},${agreed.lng}  (${agreed.metres}m apart, ${agreed.by})`);

    const wrong = evs.filter((e) => distanceMeters(e.lat!, e.lng!, agreed.lat, agreed.lng) > threshold);
    for (const p of pins) {
      const off = Math.round(distanceMeters(p.lat, p.lng, agreed.lat, agreed.lng));
      console.log(`[pins]     ${String(p.count).padStart(3)} listing(s) at ${p.lat},${p.lng} — ${off}m off`);
    }
    // NEVER SILENTLY UNDO A HAND-SETTLED ROOM. Two geocoders agreeing is not
    // proof the ADDRESS was right: Duluth & Case Recreation Center resolved
    // cleanly, twice, 3m apart — off an address no city page carries. The city's
    // own site says 1020 Duluth St, and both of our stored addresses were wrong.
    // So a pin that somebody confirmed against the venue's own page outranks
    // anything this script derives from our own listings, and replacing it takes
    // --force.
    const prior = known.get(key);
    if (prior && distanceMeters(prior.lat, prior.lng, agreed.lat, agreed.lng) > threshold) {
      const weak = /single opinion/.test(prior.source ?? "");
      const gap = Math.round(distanceMeters(prior.lat, prior.lng, agreed.lat, agreed.lng));
      if (!weak && !force) {
        console.warn(
          `[pins] ⚠ KEPT the stored pin ${prior.lat},${prior.lng} (${prior.source}).\n` +
            `[pins]   Today's answer is ${gap}m away. Refusing to replace a confirmed pin —\n` +
            `[pins]   pass --force if the venue has genuinely moved.`,
        );
        continue;
      }
      console.warn(`[pins] ⚠ replacing stored pin ${prior.lat},${prior.lng} (${prior.source}), ${gap}m away`);
    }

    if (!apply) continue;

    await sql`
      insert into venue_coords (room_key, lat, lng, label, source, agreed_m, set_at)
      values (${key}, ${agreed.lat}, ${agreed.lng}, ${(agreed.label ?? "").slice(0, 300)}, ${agreed.by.slice(0, 200)}, ${agreed.metres}, now())
      on conflict (room_key) do update set
        lat = excluded.lat, lng = excluded.lng, label = excluded.label,
        source = excluded.source, agreed_m = excluded.agreed_m, set_at = now()
    `;
    if (wrong.length === 0) continue;

    // verified_at is NOT touched. The verify pass is shown title, venue, city
    // and start; it never sees a coordinate, so moving a pin cannot invalidate
    // its stamp — and clearing 95 stamps would re-queue a week of paid
    // verification to re-establish facts this change never touched.
    await sql`
      update events set lat = ${agreed.lat}, lng = ${agreed.lng}, updated_at = now()
      where id::text = any(${wrong.map((e) => e.id)})
    `;
    await sql`
      insert into admin_audit (action, patch)
      values ('venue_pin', ${sql.json({
        room: key,
        to: { lat: agreed.lat, lng: agreed.lng },
        listings: wrong.length,
        worstOffBy: Math.max(...wrong.map((e) => Math.round(distanceMeters(e.lat!, e.lng!, agreed.lat, agreed.lng)))),
        source: agreed.by.slice(0, 200),
        agreedMetres: agreed.metres,
      })})
    `;
    synced += wrong.length;
    console.log(`[pins]     ✓ moved ${wrong.length} listing(s)`);
  }

  console.log(
    `\n[pins] ${settled} room(s) settled, ${unsettled} left alone, ${synced} listing(s) moved` +
      `${apply ? "" : " — DRY RUN, re-run with --apply"}`,
  );
  if (apply && synced > 0) await revalidateAndReport("pins", `${synced} listing pin(s) corrected`);
  if (unsettled > 0) process.exitCode = 1;
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[pins] fatal:", err);
  process.exitCode = 1;
});
