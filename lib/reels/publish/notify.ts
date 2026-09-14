/**
 * Ops notification for the publish run — one plain-text email via Resend
 * (plain fetch, no SDK, same as every other sender in lib/).
 *
 * Degrading gracefully is the design, not an error: missing config or a
 * failed send logs the full message to the console and returns "logged".
 * An ops-email failure must never fail a publish run (house rule #1 —
 * a broken instrument must not kill its panel).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "City Pulse Reels <onboarding@resend.dev>";

export interface OpsEmail {
  subject: string;
  lines: string[];
}

export interface OpsEmailDeps {
  fetchJson(
    url: string,
    init: { method: "POST"; headers: Record<string, string>; body: string },
  ): Promise<{ ok: boolean; status: number }>;
}

export const defaultOpsEmailDeps: OpsEmailDeps = {
  fetchJson: async (url, init) => {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status };
  },
};

/** The whole message, so the console fallback loses nothing vs the email. */
function renderForLog(email: OpsEmail): string {
  return [email.subject, ...email.lines].join("\n");
}

/**
 * Send { subject, lines } to the operator inbox (OPS_DIGEST_TO). Returns
 * "sent" only if Resend accepted it; every other path — missing env, API
 * error, thrown fetch — warns with the full message and returns "logged".
 * Never throws.
 */
export async function sendOpsEmail(
  email: OpsEmail,
  env: Record<string, string | undefined> = process.env,
  deps: OpsEmailDeps = defaultOpsEmailDeps,
): Promise<"sent" | "logged"> {
  const apiKey = env.RESEND_API_KEY;
  const to = env.OPS_DIGEST_TO;
  if (!apiKey || !to) {
    console.warn(
      `[reels-publish] missing ${!apiKey ? "RESEND_API_KEY" : "OPS_DIGEST_TO"} — ` +
        `ops email logged instead of sent:\n${renderForLog(email)}`,
    );
    return "logged";
  }
  try {
    const res = await deps.fetchJson(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.DIGEST_FROM ?? DEFAULT_FROM,
        to: [to],
        subject: email.subject,
        text: email.lines.join("\n"),
      }),
    });
    if (!res.ok) {
      console.warn(
        `[reels-publish] Resend ${res.status} — ops email logged instead of sent:\n${renderForLog(email)}`,
      );
      return "logged";
    }
    return "sent";
  } catch (err) {
    console.warn(
      `[reels-publish] ops email failed (${err instanceof Error ? err.message : String(err)}) — ` +
        `logged instead:\n${renderForLog(email)}`,
    );
    return "logged";
  }
}
