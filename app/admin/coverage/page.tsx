import { getCoverageEvents, getCategoryDemand } from "@/lib/admin";
import { assessCoverage, assessDemand, WEEKLY_FLOORS } from "@/lib/coverage";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function AdminCoveragePage() {
  const events = await getCoverageEvents();
  const report = assessCoverage(events, new Date(), 4);
  // F1.1 — the demand side: 30-day views/clicks per category, against upcoming
  // supply (report.totals is the 4-week published count, one shared source).
  const demand = assessDemand(await getCategoryDemand(30), report.totals);

  const empties = report.alerts.filter((a) => a.status === "empty");
  const thins = report.alerts.filter((a) => a.status === "thin");

  return (
    <div className="admin-section">
      {report.healthy ? (
        <div className="cov-banner ok">
          ✓ Every category meets its weekly floor for the next 4 weeks.
        </div>
      ) : (
        <div className={`cov-banner ${empties.length > 0 ? "bad" : "warn"}`}>
          {empties.length > 0 && (
            <div>
              <strong>{empties.length} empty</strong> category-week
              {empties.length > 1 ? "s" : ""} — a visitor would see a blank collection.
            </div>
          )}
          {thins.length > 0 && (
            <div>
              {thins.length} thin category-week{thins.length > 1 ? "s" : ""} (below floor).
            </div>
          )}
        </div>
      )}

      <p className="admin-note">
        Published events per category, per week. A category below its weekly floor is
        flagged — that&apos;s how an empty &ldquo;Live Music&rdquo; collection gets caught
        here instead of by a visitor.
      </p>

      <div className="cov-wrap">
        <table className="cov-table">
          <thead>
            <tr>
              <th>Category</th>
              {report.weeks.map((w) => (
                <th key={w.key}>wk of {w.label}</th>
              ))}
              <th>Floor</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_KEYS.map((cat) => {
              const row = report.cells.filter((c) => c.category === cat);
              return (
                <tr key={cat}>
                  <td className="cov-cat">
                    <span className="dot" style={{ background: CATEGORIES[cat].color }} />
                    {CATEGORIES[cat].label}
                  </td>
                  {row.map((c) => (
                    <td key={c.week} className={`cov-cell ${c.status}`}>
                      {c.count}
                    </td>
                  ))}
                  <td className="cov-floor">{WEEKLY_FLOORS[cat]}</td>
                  <td className="cov-total">{report.totals[cat]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cov-legend">
        <span className="cov-cell ok">ok</span> meets floor
        <span className="cov-cell thin">thin</span> below floor
        <span className="cov-cell empty">0</span> empty — collection would look dead
      </div>

      {!report.healthy && (
        <>
          <h3 className="admin-subhead">What to do</h3>
          <p className="admin-note">
            An empty or thin category usually means <strong>discovery</strong>, not
            classification. Add rooms for that category to the venue registry
            (<code>lib/venues.ts</code>) so the next pipeline run sweeps them, and check the
            Pipeline tab for agent failures in that category.
          </p>
        </>
      )}

      {/* F1.1 — demand: is the supply we have earning its keep? */}
      <h3 className="admin-subhead">Demand (last 30 days)</h3>
      {demand.hasSignal ? (
        <>
          <p className="admin-note">
            Views and ticket clicks per category, against upcoming supply. Sorted by
            <strong> views per upcoming event</strong> — the top rows are where readers
            want more than we currently offer; the bottom rows are well-supplied but
            quiet. This is a supply signal, not a verdict.
          </p>
          <div className="cov-wrap">
            <table className="cov-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Upcoming</th>
                  <th>Views</th>
                  <th>Ticket clicks</th>
                  <th>CTR</th>
                  <th>Views / event</th>
                </tr>
              </thead>
              <tbody>
                {demand.cells.map((c) => (
                  <tr key={c.category}>
                    <td className="cov-cat">
                      <span className="dot" style={{ background: CATEGORIES[c.category].color }} />
                      {c.label}
                    </td>
                    <td className="cov-num">{c.published}</td>
                    <td className="cov-num">{c.views}</td>
                    <td className="cov-num">{c.clicks}</td>
                    <td className="cov-num">{c.views > 0 ? `${Math.round(c.ctr * 100)}%` : "—"}</td>
                    <td className="cov-num cov-intensity">
                      {c.intensity === null ? "—" : c.intensity.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cov-legend">
            {demand.totalViews} views · {demand.totalClicks} ticket clicks · {demand.totalSaves} saves
            {" "}across all categories (30 days).
          </div>
        </>
      ) : (
        <p className="admin-note">
          Not enough engagement data yet to read demand ({demand.totalViews} views in 30
          days). This fills in as visits accumulate — check back once the numbers climb.
        </p>
      )}
    </div>
  );
}
