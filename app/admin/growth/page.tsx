import { Suspense } from "react";
import {
  getSubscriberRows,
  getSaveRows,
  getReferrerRows,
  getFunnelCounts,
  weeklyCohorts,
  churnRate,
  trend,
  buildFunnel,
  returningReaders,
  pct,
  delta,
  answeredWithin,
} from "@/lib/growth";
import { byChannel, referrerLabel } from "@/lib/referrers";
import { getSearchImpressions, getSearchAnalyticsByDimension } from "@/lib/search-console";
import { getSubscribersBySource } from "@/lib/subscribe";

/**
 * Audience and growth on one screen.
 *
 * THE RULE THIS PAGE IS BUILT ON: every rate is earned. We count actions, not
 * people — `event_stats` is identity-free by design — so a "conversion rate"
 * off views would be fiction dressed as arithmetic. Where a denominator does
 * not exist the page prints an em dash and says why, in the same voice the rest
 * of the site uses about a date it cannot source.
 *
 * Unique visitors are deliberately absent. Counting them needs an identifier,
 * which is a different promise to readers than the one docs/ANALYTICS.md and
 * the privacy policy currently make. Vercel Analytics has them; there is a link.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const metadata = { title: "Growth · City Pulse Admin" };

/**
 * No single source may hold the page. On 21 Sep 2026 this page began answering
 * 504: adding GSC_SERVICE_ACCOUNT_JSON in Vercel turned two early-returning
 * stubs into four live, unbounded round-trips to Google, and `allSettled`
 * waits for the slowest. The calls themselves are bounded now, in
 * lib/search-console.ts, which is the real fix and also covers the Monday ops
 * email. This is the generic one: whatever goes slow next — a hung pool, a new
 * vendor — becomes a section that says it could not be read, on a page that
 * still renders, instead of a gateway timeout on all of it.
 *
 * Twelve seconds sits under maxDuration with room for the rest of the render.
 */
const SOURCE_DEADLINE_MS = 12_000;
const within = <T,>(work: Promise<T>, label: string) =>
  answeredWithin(work, SOURCE_DEADLINE_MS, label);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-n">{value}</div>
      <div className="admin-stat-l">{label}</div>
      {sub && <div className="admin-stat-s">{sub}</div>}
    </div>
  );
}

async function GrowthBody() {
  const now = new Date();

  /**
   * A FAILED QUERY MUST NOT RENDER AS DATA.
   *
   * The first version of this page caught every rejection into an empty value,
   * and a broken funnel query (`date > integer`) came out as four clean zeros —
   * indistinguishable from a quiet month, and the exact shape of every silent
   * failure this project has been bitten by. `allSettled` keeps the reason, so
   * a section that could not be read says so instead of showing nothing and
   * letting nothing look like a fact.
   */
  const settled = await Promise.allSettled([
    within(getSubscriberRows(), "Subscribers"),
    within(getSaveRows(90), "Saves"),
    within(getReferrerRows(30), "Referrers"),
    within(getFunnelCounts(30), "Funnel"),
    within(getSubscribersBySource(), "Sources"),
    within(getSearchImpressions(28, now), "Search Console"),
    within(getSearchAnalyticsByDimension("query", 28, now), "Search Console queries"),
  ]);
  const failed = (i: number): string | null =>
    settled[i].status === "rejected"
      ? String((settled[i] as PromiseRejectedResult).reason).slice(0, 160)
      : null;
  const val = <T,>(i: number, fallback: T): T =>
    settled[i].status === "fulfilled" ? ((settled[i] as PromiseFulfilledResult<T>).value ?? fallback) : fallback;

  const subs = val(0, [] as Awaited<ReturnType<typeof getSubscriberRows>>);
  const saves = val(1, [] as Awaited<ReturnType<typeof getSaveRows>>);
  const refs = val(2, [] as Awaited<ReturnType<typeof getReferrerRows>>);
  const counts = val(3, { views: 0, ticketClicks: 0, saves: 0, calendarAdds: 0, newSubscribers: 0 });
  const sources = val(4, [] as Awaited<ReturnType<typeof getSubscribersBySource>>);
  const search = val(5, null as Awaited<ReturnType<typeof getSearchImpressions>>);
  const queries = val(6, [] as Awaited<ReturnType<typeof getSearchAnalyticsByDimension>>);

  const brokeSubs = failed(0);
  const brokeRefs = failed(2);
  const brokeFunnel = failed(3);
  const brokeSaves = failed(1);

  const cohorts = weeklyCohorts(subs, now, 12);
  const t = trend(cohorts, 4);
  const churn = churnRate(subs);
  const active = subs.filter((s) => !s.unsubscribed_at).length;
  const funnel = buildFunnel(counts);
  const readers = returningReaders(saves);
  const channels = byChannel(refs);
  const peak = Math.max(1, ...cohorts.map((c) => c.joined));

  return (
    <>
      <p className="admin-intro">
        Everything here is counted in our own database. Rates appear only where a
        real denominator exists — an em dash means we will not guess one.
      </p>

      {/* ───────────────────────────── subscribers ───────────────────────────── */}
      <h3 className="admin-h3">The list</h3>
      {brokeSubs && <div className="admin-empty">Could not read the subscriber table: {brokeSubs}</div>}
      <div className="admin-stats-grid">
        <Stat label="Subscribers" value={String(active)} sub={`${subs.length} ever joined`} />
        <Stat
          label="Churn"
          value={pct(churn)}
          sub={churn === null ? "nobody has subscribed yet" : `${subs.length - active} unsubscribed`}
        />
        <Stat
          label="Last 4 weeks"
          value={t ? String(t.recent) : "—"}
          sub={t ? `${delta(t.recent, t.previous)} vs the 4 before · ${t.direction}` : "not enough history"}
        />
      </div>

      <h3 className="admin-h3">Signups by week</h3>
      {cohorts.every((c) => c.joined === 0) ? (
        <div className="admin-empty">No signups in the last 12 weeks.</div>
      ) : (
        <div className="g-bars">
          {cohorts.map((c) => (
            <div className="g-bar" key={c.weekStart}>
              <div className="g-bar-n">{c.joined || ""}</div>
              <div className="g-bar-fill" style={{ height: `${(c.joined / peak) * 100}%` }} />
              <div className="g-bar-l">{c.weekStart.slice(5)}</div>
            </div>
          ))}
        </div>
      )}
      <p className="admin-intro">
        Weeks with no signups are shown. A flat stretch is information; hiding it
        turns a plateau into a line that looks like growth.
      </p>

      {sources.length > 0 && (
        <>
          <h3 className="admin-h3">Where subscribers signed up</h3>
          <div className="cov-wrap"><table className="cov-table">
            <thead>
              <tr><th>Placement</th><th>Subscribers</th><th>Last 30d</th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td>{s.total}</td>
                  <td>{s.last30d}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}

      {/* ───────────────────────────── acquisition ───────────────────────────── */}
      <h3 className="admin-h3">Found on search — last 28 days</h3>
      {search ? (
        <div className="admin-stats-grid">
          <Stat label="Impressions" value={search.impressions.toLocaleString()} />
          <Stat label="Clicks" value={search.clicks.toLocaleString()} />
          <Stat label="CTR" value={pct(search.ctr, 1)} />
        </div>
      ) : (
        <div className="admin-empty">
          Search Console did not answer. Set <code>GSC_SERVICE_ACCOUNT_JSON</code> to
          turn this on — it is the same data the Monday email reports.
        </div>
      )}

      {queries.length > 0 && (
        <>
          <h4 className="admin-h4">What people searched to find us</h4>
          <div className="cov-wrap"><table className="cov-table">
            <thead>
              <tr><th>Query</th><th>Impressions</th><th>Clicks</th><th>Position</th></tr>
            </thead>
            <tbody>
              {queries.slice(0, 15).map((q) => (
                <tr key={q.key}>
                  <td>{q.key}</td>
                  <td>{q.impressions.toLocaleString()}</td>
                  <td>{q.clicks}</td>
                  <td>{q.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}

      <h3 className="admin-h3">How people arrived — last 30 days</h3>
      {brokeRefs ? (
        <div className="admin-empty">Could not read referrer_stats: {brokeRefs}</div>
      ) : channels.length === 0 ? (
        <div className="admin-empty">
          No referrer data yet. Counting starts with the next deploy; only the
          referring <em>hostname</em> is ever recorded, never a URL.
        </div>
      ) : (
        <div className="cov-wrap"><table className="cov-table">
          <thead>
            <tr><th>Channel</th><th>Arrivals</th><th>Share</th></tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.channel}>
                <td>{c.channel}</td>
                <td>{c.count.toLocaleString()}</td>
                <td>{pct(c.share)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {refs.length > 0 && (
        <>
          <h4 className="admin-h4">Top sources</h4>
          <div className="cov-wrap"><table className="cov-table">
            <thead><tr><th>Source</th><th>Arrivals</th></tr></thead>
            <tbody>
              {refs.slice(0, 12).map((r) => (
                <tr key={r.host}>
                  <td>{referrerLabel(r.host)}</td>
                  <td>{r.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}

      {/* ─────────────────────────────── funnel ──────────────────────────────── */}
      <h3 className="admin-h3">The funnel — last 30 days</h3>
      {brokeFunnel ? (
        <div className="admin-empty">Could not read the counters: {brokeFunnel}</div>
      ) : (
      <div className="g-funnel">
        {funnel.map((s) => (
          <div className="g-step" key={s.label}>
            <div className="g-step-top">
              <span className="g-step-l">{s.label}</span>
              <span className="g-step-n">{s.count.toLocaleString()}</span>
            </div>
            <div className="g-step-rate">
              {s.rate === null ? <span className="g-step-why">— {s.why}</span> : `${pct(s.rate, 1)} of views`}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* ──────────────────────────── returning ──────────────────────────────── */}
      <h3 className="admin-h3">Readers who came back — last 90 days</h3>
      {brokeSaves && <div className="admin-empty">Could not read saved_events: {brokeSaves}</div>}
      <div className="admin-stats-grid">
        <Stat label="People who saved" value={String(readers.people)} sub={`${readers.saves} saves`} />
        <Stat
          label="Came back another day"
          value={String(readers.returning)}
          sub={readers.returnRate === null ? "nobody has saved yet" : `${pct(readers.returnRate)} of savers`}
        />
      </div>
      <p className="admin-intro">
        The only place we can count <em>people</em> rather than actions:{" "}
        <code>saved_events</code> carries an anonymous per-browser token. Four saves
        in one sitting is enthusiasm, not a return, so &ldquo;came back&rdquo; means a
        second <em>day</em>.
      </p>

      <h3 className="admin-h3">What is deliberately not here</h3>
      <div className="admin-empty" style={{ textAlign: "left" }}>
        <p>
          <strong>Unique visitors and sessions.</strong> Counting them needs a
          per-person identifier, and our analytics tables hold none — that is the
          design, not an oversight, and the privacy policy says so to readers.
        </p>
        <p style={{ marginTop: 8 }}>
          Vercel Analytics is mounted site-wide and has those numbers:{" "}
          <a href="https://vercel.com/dashboard/analytics" target="_blank" rel="noreferrer">
            open Vercel Analytics ↗
          </a>
        </p>
      </div>
    </>
  );
}

/**
 * The shell answers immediately and the numbers stream in behind it.
 *
 * Deadlines alone were not enough. `maxDuration` is a ceiling on the function,
 * not a promise about time-to-first-byte, so a page that awaits everything
 * before emitting a byte can still be killed at the gateway — which is exactly
 * what a 504 is. /admin/ops learned this in September and dropped to 0.09s warm
 * by streaming; this is the same trick, one boundary instead of two, because
 * this page's sections all read quickly or not at all.
 */
export default function AdminGrowthPage() {
  return (
    <Suspense fallback={<div className="ops-skeleton">counting subscribers, saves and search…</div>}>
      <GrowthBody />
    </Suspense>
  );
}
