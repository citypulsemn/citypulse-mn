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

  const result = await mergeAndRestore(id, exp, t);
  redirect(result === "restored" ? "/saved?restored=1" : "/saved?restore=invalid");
}
