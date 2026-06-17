// OPTIONAL ALTERNATIVE to the GitHub Actions pipeline (scripts/run-pipeline.ts).
// Use Trigger.dev when you want durable multi-step orchestration, automatic
// retries, run-level observability, or human-in-the-loop approval waitpoints.
//
// To adopt: move this file and ./weekly-research.ts to the project root in a
// `trigger/` dir, then `npm i @trigger.dev/sdk`. Note: the Trigger.dev SDK
// pulls in OpenTelemetry/telemetry transitive deps with their own advisories;
// they run on Trigger.dev's infrastructure and are not in your website bundle.
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_replace_me", // from the Trigger.dev dashboard
  dirs: ["./trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000 },
  },
});
