import { redirect } from "next/navigation";
import { mergeAndRestore } from "@/lib/saved-restore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Magic-link landing (roadmap 5.4). Verifies the signed link, merges any saves
 * this device already has into the linked identity, points the cookie at it,
 * and lands on /saved with a banner. Invalid/expired links land with a plain
 * explanation — never an error page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const t = url.searchParams.get("t") ?? "";

  // "Never an error page" is a printed promise — an unexpected throw degrades
  // to the invalid-link banner (R0.4: a column typo 500'd here for weeks).
  // redirect() itself throws NEXT_REDIRECT by design, so it stays OUTSIDE.
  let result = "invalid";
  try {
    result = await mergeAndRestore(id, exp, t);
  } catch (err) {
    console.error("[saved-restore] unexpected failure, degrading to invalid:", err);
  }
  redirect(result === "restored" ? "/saved?restored=1" : "/saved?restore=invalid");
}
