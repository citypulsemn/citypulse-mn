import { gatherOpsInputs } from "@/lib/ops-inputs";
import { buildSections } from "@/lib/ops-digest";
import { gatherVendorTiles } from "@/lib/vendors";
import { summarise, worstStatus, needsAttention, type VendorTile } from "@/lib/vendor-health";

/**
 * The one screen that answers "is anything wrong right now?"
 *
 * It is the Monday ops email, on demand, on a phone — the SAME `gatherOpsInputs`
 * and the SAME `buildSections` the sender uses, so the page and the email can
 * never disagree. Above them sit the vendor probes, which cover the half of the
 * system our own database cannot see and where every recent incident actually
 * lived.
 *
 * DESIGN NOTE — why alerts are not collapsed away. Sections in trouble render
 * first and open; healthy ones render below. Nothing is hidden behind a tab or
 * a click, because the failure mode this page exists to prevent is a problem
 * nobody looked at, and one more click is one more chance not to look.
 */
export const dynamic = "force-dynamic"; // ops is always live, never cached

export const metadata = { title: "Ops · City Pulse Admin" };

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

export default async function AdminOpsPage() {
  const now = new Date();

  // Independently settled: the vendor probes must not be able to take the
  // in-house sections down with them, or vice versa.
  const [inputsResult, tilesResult] = await Promise.allSettled([
    gatherOpsInputs(),
    gatherVendorTiles(now),
  ]);

  const tiles = tilesResult.status === "fulfilled" ? tilesResult.value : [];
  const sections =
    inputsResult.status === "fulfilled"
      ? buildSections(inputsResult.value)
      : [
          {
            title: "Everything",
            lines: [
              `the gather failed outright: ${
                inputsResult.reason instanceof Error
                  ? inputsResult.reason.message
                  : String(inputsResult.reason)
              }`,
            ],
            alert: true,
          },
        ];

  const alerts = sections.filter((s) => s.alert);
  const healthy = sections.filter((s) => !s.alert);
  const vendorWorst = worstStatus(tiles);
  const attention = alerts.length + tiles.filter((t) => needsAttention(t.status)).length;

  return (
    <>
      <div className={`ops-banner ${attention === 0 ? "ops-ok" : "ops-warn"}`}>
        <strong>
          {attention === 0 ? "✅ All green" : `⚠️ ${attention} thing${attention === 1 ? "" : "s"} to look at`}
        </strong>
        <span>
          {now.toLocaleString("en-US", {
            timeZone: "America/Chicago",
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · live, not cached
        </span>
      </div>

      <h2 className="ops-h">Outside services</h2>
      <p className="admin-intro">{summarise(tiles)}</p>
      {tiles.length === 0 ? (
        <div className="admin-empty">
          The vendor probes did not run at all. That is itself the alert — see lib/vendors.ts.
        </div>
      ) : (
        <div className="ops-tiles">
          {tiles
            .slice()
            .sort((a, b) => Number(needsAttention(b.status)) - Number(needsAttention(a.status)))
            .map((t) => (
              <VendorCard key={t.service} t={t} />
            ))}
        </div>
      )}
      {vendorWorst === "unknown" && (
        <p className="admin-intro">
          A grey tile means the check could not run — usually a missing token. It is never a pass.
        </p>
      )}

      <h2 className="ops-h">The calendar itself</h2>
      {alerts.length === 0 && <p className="admin-intro">No section is flagging anything.</p>}
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

      <p className="admin-intro ops-foot">
        Same gather and same formatter as the Monday email (<code>npm run ops-digest</code>). If this
        page and that email ever disagree, one of them is lying and it is a bug.
      </p>
    </>
  );
}
