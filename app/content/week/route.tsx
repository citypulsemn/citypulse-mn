import { ImageResponse } from "next/og";
import { getEvents } from "@/lib/events";
import { weeklyPicks } from "@/lib/content/weekly-picks";
import { shortDate } from "@/lib/content/templates";
import { oswaldSemiBold } from "@/lib/brand/oswald-font";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;
const NAVY = "#0e1830";
const GOLD = "#c9a961";
const CREAM = "#f1ece0";
const CREAM_DIM = "#c7c1b3";

export async function GET() {
  const events = await getEvents();
  const picks = weeklyPicks(events, new Date());
  const fonts = [{ name: "Oswald", data: oswaldSemiBold, weight: 600 as const, style: "normal" as const }];

  // Up to 6 lines: family + unique highlights, then top regulars.
  const rows: { title: string; sub: string }[] = [];
  if (picks.family) rows.push({ title: picks.family.title, sub: `${shortDate(picks.family.start)} · ${picks.family.venue}` });
  if (picks.unique) rows.push({ title: picks.unique.title, sub: `${shortDate(picks.unique.start)} · ${picks.unique.venue}` });
  for (const e of picks.regular) {
    if (rows.length >= 6) break;
    rows.push({ title: e.title, sub: `${shortDate(e.start)} · ${e.venue}` });
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%", background: NAVY, fontFamily: "Oswald", padding: "84px 76px" }}>
        <div style={{ position: "absolute", top: 30, left: 30, right: 30, bottom: 30, border: `3px solid ${GOLD}`, borderRadius: 26 }} />
        <div style={{ position: "absolute", top: 44, left: 44, right: 44, bottom: 44, border: "1px solid rgba(201,169,97,0.4)", borderRadius: 18 }} />

        <div style={{ display: "flex", color: GOLD, fontSize: 30, letterSpacing: 7, textTransform: "uppercase" }}>City Pulse MN</div>
        <div style={{ display: "flex", color: CREAM, fontSize: 78, lineHeight: 1.02, marginTop: 18 }}>This Week in the Twin Cities</div>
        <div style={{ display: "flex", height: 3, background: GOLD, width: 180, margin: "30px 0 12px" }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          {rows.length === 0 ? (
            <div style={{ display: "flex", color: CREAM_DIM, fontSize: 40 }}>Fresh picks landing soon.</div>
          ) : (
            rows.map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 26 }}>
                <div style={{ display: "flex", color: CREAM, fontSize: 46, lineHeight: 1.05 }}>{r.title}</div>
                <div style={{ display: "flex", color: GOLD, fontSize: 30, marginTop: 4 }}>{r.sub}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", color: GOLD, fontSize: 34, letterSpacing: 3 }}>citypulsemn.com · link in bio</div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}
