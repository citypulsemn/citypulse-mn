# Trigger.dev pipeline (optional alternative)

This is the same weekly pipeline as `scripts/run-pipeline.ts`, expressed as a
Trigger.dev scheduled task. The default project uses **GitHub Actions** instead
(simpler, no extra deps). Adopt Trigger.dev when you want durable multi-step
execution, automatic retries, run-level observability, or human-in-the-loop
approval (v4 waitpoints).

## Adopt it

1. `npm i @trigger.dev/sdk`
2. Move `trigger.config.ts` to the project root and `weekly-research.ts` into a
   root `trigger/` folder; fix the relative imports (`../../lib` → `../lib`).
3. Set `project` in `trigger.config.ts` and add `TRIGGER_SECRET_KEY` to your env.
4. `npx trigger.dev@latest dev` to test, then deploy.

> Heads up: the Trigger.dev SDK pulls in OpenTelemetry/telemetry transitive
> dependencies that carry their own security advisories. They execute on
> Trigger.dev's infrastructure and are not part of your website bundle — which
> is exactly why this isn't installed in the default project.
