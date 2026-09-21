import { Suspense } from "react";
import { gatherOpsInputs } from "@/lib/ops-inputs";
import { buildSections } from "@/lib/ops-digest";
import { gatherVendorTiles } from "@/lib/vendors";
import {
  summarise,
  needsAttention,
  withDeadline,
  unknownTile,
  type VendorTile,
} from "@/lib/vendor-health";

/**
 * The one screen that answers "is anything wrong right now?"
 *
 * It is the Monday ops email, on demand, on a phone — the SAME `gatherOpsInputs`
 * and the SAME `buildSections` the sender uses, so the page and the email can
 * never disagree. Above them sit the vendor probes, which cover the half of the
 * system our own database cannot see.
 *
 * WHY THIS STREAMS. The first version awaited both gathers before rendering
 * anything, and on 14 Sep 2026 it span forever in production. Twenty sequential
 * queries and five HTTP calls behind one `await` is a page with no floor on how
 * slow it can get, and a spinner is the least useful thing an ops screen can
 * show — the one moment you need it is the moment something is already wrong.
 *
 * So each half is its own Suspense boundary with its own deadline. The shell
 * paints immediately, each section fills in when it can, and a section that
 * overruns says so instead of holding the page hostage. Same rule as the tiles:
 * "could not tell" is an answer, not a wait.
 */
export const dynamic = "force-dynamic"; // ops is always live, never cached

/** A hard stop well inside any platform limit, so the page cannot hang. */
export const maxDuration = 30;
const VENDOR_DEADLINE_MS = 8_000;
const CALENDAR_DEADLINE_MS = 15_000;

export const metadata = { title: "Ops · City Pulse Admin" };

function Skeleton({ label }: { label: string }) {
  return <div className="ops-skeleton">checking {label}…</div>;
}

function VendorCard({ t }: { t: VendorTile }) {
  return (
    <a className={`ops-tile ops-${t.status}`} href={t.link} target="_blank" rel="noreferrer">
      <div className="ops-tile-top">
        <span className="ops-dot" aria-hidden />
        <span className="ops-tile-name">{t.service}</span>
        <span className="ops-tile-status">{t.status}</span>
      </div>
      <div className="ops-tile-headline">{t.headline}</div>
      <div className="ops-tile-detail">{t.detail}</div>
    </a>
  );
}

/** The five outside services. Never throws; never waits past its deadline. */
/**
 * A NOTE ON THESE TWO FALLBACK MESSAGES.
 *
 * They used to name a cause: "the probes are slow or a vendor is hanging" and
 * "the database is slow or unreachable". On 21 Sep 2026 the second one was
 * read off the screen as a diagnosis, and it was wrong — the database was
 * answering in under a second and using 9 of its 60 connections at the time.
 *
 * A timeout knows one fact: the ceiling was reached. It does not know why, and
 * a panel built to refuse "could not tell" dressed as data should not be the
 * one place that guesses. They report the fact and point at the log now.
 */
async function VendorSection() {
  const now = new Date();
  let tiles: VendorTile[];
  try {
    tiles =
      (await withDeadline(gatherVendorTiles(now), VENDOR_DEADLINE_MS, null)) ??
      [
        unknownTile(
          "Outside services",
          `no answer within ${VENDOR_DEADLINE_MS / 1000}s — every probe missed its own ceiling too, which points at the runtime rather than at any one vendor`,
          "#",
        ),
      ];
  } catch (err) {
    tiles = [unknownTile("Outside services", err instanceof Error ? err.message : String(err), "#")];
  }

  return (
    <>
      <p className="admin-intro">{summarise(tiles)}</p>
      <div className="ops-tiles">
        {tiles
          .slice()
          .sort((a, b) => Number(needsAttention(b.status)) - Number(needsAttention(a.status)))
          .map((t) => (
            <VendorCard key={t.service} t={t} />
          ))}
      </div>
      <p className="admin-intro">
        A grey tile means the check could not run — usually a missing token. It is never a pass.
      </p>
    </>
  );
}

/** Everything the Monday email reads, through the Monday email's own formatter. */
async function CalendarSection() {
  let sections: { title: string; lines: string[]; alert?: boolean }[];
  try {
    const inputs = await withDeadline(gatherOpsInputs(), CALENDAR_DEADLINE_MS, null);
    sections = inputs
      ? buildSections(inputs)
      : [
          {
            title: "Everything",
            lines: [
              `no answer within ${CALENDAR_DEADLINE_MS / 1000}s — the Vercel function log says what it was waiting on`,
            ],
            alert: true,
          },
        ];
  } catch (err) {
    sections = [
      {
        title: "Everything",
        lines: [`the gather failed: ${err instanceof Error ? err.message : String(err)}`],
        alert: true,
      },
    ];
  }

  const alerts = sections.filter((s) => s.alert);
  const healthy = sections.filter((s) => !s.alert);

  return (
    <>
      <p className="admin-intro">
        {alerts.length === 0
          ? "✅ no section is flagging anything"
          : `⚠️ ${alerts.length} section${alerts.length === 1 ? "" : "s"} flagging`}
      </p>
      {[...alerts, ...healthy].map((s) => (
        <section key={s.title} className={`ops-section ${s.alert ? "ops-section-alert" : ""}`}>
          <h3>
            {s.title}
            {s.alert && <span className="ops-flag">needs a look</span>}
          </h3>
          <ul>
            {s.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function AdminOpsPage() {
  const now = new Date();
  return (
    <>
      <div className="ops-banner">
        <strong>Operations</strong>
        <span>
          {now.toLocaleString("en-US", {
            timeZone: "America/Chicago",
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · live, not cached · reload to re-check
        </span>
      </div>

      <h2 className="ops-h">Outside services</h2>
      <Suspense fallback={<Skeleton label="GitHub, Vercel, Supabase, Anthropic and the weekly email" />}>
        <VendorSection />
      </Suspense>

      <h2 className="ops-h">The calendar itself</h2>
      <Suspense fallback={<Skeleton label="the pipeline, coverage, verification and the queue" />}>
        <CalendarSection />
      </Suspense>

      <p className="admin-intro ops-foot">
        Same gather and same formatter as the Monday email (<code>npm run ops-digest</code>). If this
        page and that email ever disagree, one of them is lying and it is a bug.
      </p>
    </>
  );
}
