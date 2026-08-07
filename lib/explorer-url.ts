import { CATEGORY_KEYS } from "./categories";
import { AREAS } from "./areas";
import { isValidDayKey } from "./event-view";
import type { AreaKey } from "./areas";
import type { CategoryKey, PriceTier, RangeKey } from "./types";

/**
 * UX11 — URL-addressable explorer state. The homepage explorer keeps its
 * view/range/month/categories/filters/search/open-overlay in the URL query, so
 * a reload, a shared link, and browser Back/Forward all reproduce what you were
 * looking at. This module is the pure, golden-tested seam: serialize state → a
 * canonical query string (defaults omitted, keys in a fixed order), and parse a
 * query string → validated fields (junk silently dropped). The component owns
 * the History API wiring; the encoding lives here.
 *
 * Category keys use their internal names (…"weird"…) — this is functional state,
 * not user prose, and a mapping layer would just be a bug surface. Price tiers
 * map to digit tokens so no "$" ever lands in the query string.
 */

export type ExplorerView = "list" | "calendar" | "map";

export interface ExplorerState {
  view: ExplorerView;
  range: RangeKey;
  year: number;
  month: number; // 0-11
  cats: Set<CategoryKey>;
  prices: Set<PriceTier>;
  areas: Set<AreaKey>;
  query: string;
  day: string | null; // YYYY-MM-DD, an open day panel
  event: string | null; // an open event modal (event id)
}

export interface ExplorerDefaults {
  view: ExplorerView;
  range: RangeKey;
  year: number;
  month: number; // 0-11
}

const VIEWS: readonly ExplorerView[] = ["list", "calendar", "map"];
const RANGES: readonly RangeKey[] = ["today", "weekend", "week", "month"];
const CAT_SET = new Set<string>(CATEGORY_KEYS);
const AREA_KEYS = AREAS.map((a) => a.key);
const AREA_SET = new Set<string>(AREA_KEYS);

// Price tier ↔ URL token (keep "$" out of the query string).
const PRICE_ORDER: readonly PriceTier[] = ["Free", "$", "$$", "$$$"];
const PRICE_TO_TOKEN: Record<PriceTier, string> = { Free: "0", $: "1", $$: "2", $$$: "3" };
const TOKEN_TO_PRICE: Record<string, PriceTier> = { "0": "Free", "1": "$", "2": "$$", "3": "$$$" };

const mm = (month: number) => String(month + 1).padStart(2, "0");

/**
 * State → canonical query string (no leading "?"). Only values that differ from
 * `defaults` are written; keys come out in a fixed order so the URL is stable
 * (and comparable to detect no-op writes). Commas are left literal for
 * readability of shared links.
 */
export function serializeExplorer(s: ExplorerState, d: ExplorerDefaults): string {
  const p = new URLSearchParams();
  if (s.view !== d.view) p.set("view", s.view);
  if (s.range !== d.range) p.set("range", s.range);
  if (s.year !== d.year || s.month !== d.month) p.set("m", `${s.year}-${mm(s.month)}`);
  if (s.cats.size > 0 && s.cats.size < CATEGORY_KEYS.length) {
    p.set("cat", CATEGORY_KEYS.filter((k) => s.cats.has(k)).join(","));
  }
  if (s.prices.size > 0) {
    p.set("price", PRICE_ORDER.filter((t) => s.prices.has(t)).map((t) => PRICE_TO_TOKEN[t]).join(","));
  }
  if (s.areas.size > 0) {
    p.set("area", AREA_KEYS.filter((k) => s.areas.has(k)).join(","));
  }
  const q = s.query.trim();
  if (q) p.set("q", q);
  if (s.day) p.set("day", s.day);
  if (s.event) p.set("event", s.event);
  // URLSearchParams encodes commas as %2C; restore them for legible URLs.
  return p.toString().replace(/%2C/g, ",");
}

export interface ParsedExplorer {
  view?: ExplorerView;
  range?: RangeKey;
  year?: number;
  month?: number; // 0-11
  cats?: CategoryKey[];
  prices?: PriceTier[];
  areas?: AreaKey[];
  query?: string;
  day?: string;
  event?: string;
}

/** Query string → validated fields. Unknown/invalid values are dropped, never
 *  thrown on — a hand-mangled URL degrades to defaults, it doesn't crash. */
export function parseExplorer(search: string): ParsedExplorer {
  const p = new URLSearchParams(search);
  const out: ParsedExplorer = {};

  const view = p.get("view");
  if (view && VIEWS.includes(view as ExplorerView)) out.view = view as ExplorerView;

  const range = p.get("range");
  if (range && RANGES.includes(range as RangeKey)) out.range = range as RangeKey;

  const m = p.get("m");
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) {
      out.year = y;
      out.month = mo - 1;
    }
  }

  const cat = p.get("cat");
  if (cat) {
    const cats = cat.split(",").filter((k) => CAT_SET.has(k)) as CategoryKey[];
    if (cats.length) out.cats = cats;
  }

  const price = p.get("price");
  if (price) {
    const prices = price.split(",").map((t) => TOKEN_TO_PRICE[t]).filter(Boolean) as PriceTier[];
    if (prices.length) out.prices = prices;
  }

  const area = p.get("area");
  if (area) {
    const areas = area.split(",").filter((k) => AREA_SET.has(k)) as AreaKey[];
    if (areas.length) out.areas = areas;
  }

  const q = p.get("q");
  if (q && q.trim()) out.query = q;

  const day = p.get("day");
  if (day && isValidDayKey(day)) out.day = day; // real calendar date, not just the shape

  const event = p.get("event");
  if (event) out.event = event;

  return out;
}
