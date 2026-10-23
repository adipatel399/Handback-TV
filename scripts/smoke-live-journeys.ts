import { writeFile } from "node:fs/promises";
import { JourneyService } from "../server/journeys.js";
import { DEFAULT_JOURNEY_PREFERENCES as preferences } from "../server/journeys-shared.js";
const service = new JourneyService();
const checks = [];
for (const destination of preferences.destinationIds) {
  const started = Date.now();
  try {
    const plan = await service.plan(preferences, destination);
    checks.push({
      destination,
      passed: true,
      sourceUrl: plan.sourceUrl,
      checkedAt: plan.fetchedAt,
      milliseconds: Date.now() - started,
      optionsReturnedWithinLimits: plan.options.length,
      excludedOptions: plan.excludedOptions,
      allWithinLimits: plan.options.every(
        (j) =>
          j.walkingMinutes <= preferences.maxWalkingMinutes &&
          j.changes <= preferences.maxChanges,
      ),
      firstOption: plan.options[0] || null,
    });
  } catch (e) {
    checks.push({
      destination,
      passed: false,
      milliseconds: Date.now() - started,
      error: (e as Error).message,
    });
  }
}
await writeFile(
  "artifacts/live-tfl-verification.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      realNetworkRequests: true,
      service: "TfL Unified API",
      preferences,
      checks,
      noReservationMade: true,
      caveat:
        "A point-in-time API integration check, not a real journey or user study. A zero-option result can be valid under the configured constraints.",
    },
    null,
    2,
  ),
);
console.log(checks);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
