import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  LONDON_PLACES,
  type JourneyPreferences,
  type JourneyPlan,
  type JourneyOption,
  type LondonPlaceId,
} from "./journeys-shared.js";

const rawLeg = z.object({
  duration: z.number().finite().nonnegative(),
  instruction: z.object({
    summary: z.string(),
    detailed: z.string().optional(),
  }),
  mode: z.object({ id: z.string() }),
  departureTime: z.string(),
  arrivalTime: z.string(),
  departurePoint: z.object({ commonName: z.string() }),
  arrivalPoint: z.object({ commonName: z.string() }),
  disruptions: z
    .array(
      z.object({
        description: z.string().optional(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  isDisrupted: z.boolean().optional(),
});
const rawResponse = z.object({
  journeys: z
    .array(
      z.object({
        duration: z.number().finite().nonnegative(),
        startDateTime: z.string(),
        arrivalDateTime: z.string(),
        legs: z.array(rawLeg).min(1).max(30),
      }),
    )
    .max(50),
});
const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
export class JourneyUnavailable extends Error {}
export function parseJourneys(
  raw: unknown,
  prefs: JourneyPreferences,
): { options: JourneyOption[]; excludedOptions: number } {
  const data = rawResponse.parse(raw);
  const all = data.journeys.map((j) => {
    const legs = j.legs.map((l) => ({
      instruction: clean(l.instruction.summary),
      detail: clean(l.instruction.detailed || l.instruction.summary),
      mode: l.mode.id,
      duration: l.duration,
      from: clean(l.departurePoint.commonName),
      to: clean(l.arrivalPoint.commonName),
      departure: l.departureTime,
      arrival: l.arrivalTime,
      disruptions: [
        ...(l.disruptions || []).map((d) =>
          clean(d.description || d.summary || "Service disruption reported"),
        ),
        ...(l.isDisrupted
          ? [
              "This leg is reported disrupted. Check current service information before travelling.",
            ]
          : []),
      ],
    }));
    return {
      id: createHash("sha256")
        .update(JSON.stringify(legs))
        .digest("hex")
        .slice(0, 16),
      duration: j.duration,
      walkingMinutes: legs
        .filter((l) => l.mode === "walking")
        .reduce((n, l) => n + l.duration, 0),
      changes: Math.max(
        0,
        legs.filter((l) => !["walking", "cycle"].includes(l.mode)).length - 1,
      ),
      departure: j.startDateTime,
      arrival: j.arrivalDateTime,
      legs,
      warnings: [...new Set(legs.flatMap((l) => l.disruptions))],
    };
  });
  const options = all
    .filter(
      (j) =>
        j.walkingMinutes <= prefs.maxWalkingMinutes &&
        j.changes <= prefs.maxChanges,
    )
    .slice(0, 2);
  return { options, excludedOptions: all.length - options.length };
}

type Cache = { plan: JourneyPlan; at: number };
export class JourneyService {
  private cache = new Map<string, Cache>();
  private pending = new Map<string, Promise<JourneyPlan>>();
  private failures = new Map<string, number>();
  private calls: number[] = [];
  constructor(
    private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now,
  ) {}
  async plan(
    prefs: JourneyPreferences,
    destinationId: LondonPlaceId,
  ): Promise<JourneyPlan> {
    if (
      !prefs.destinationIds.includes(destinationId) ||
      prefs.originId === destinationId
    )
      throw new JourneyUnavailable(
        "Ask your helper to review your supported destinations.",
      );
    const key = JSON.stringify([prefs, destinationId]);
    const cached = this.cache.get(key),
      age = cached ? this.now() - cached.at : Infinity;
    if (cached && age < 60_000) return structuredClone(cached.plan);
    const fallback = (reason: string) => {
      if (cached && this.now() - cached.at < 5 * 60_000)
        return {
          ...structuredClone(cached.plan),
          stale: true,
          staleReason: reason,
        };
      throw new JourneyUnavailable(reason);
    };
    const inFlight = this.pending.get(key);
    if (inFlight) return structuredClone(await inFlight);
    if ((this.failures.get(key) || 0) > this.now())
      return fallback(
        "Live journey information is temporarily unavailable. Please try again shortly.",
      );
    this.calls = this.calls.filter((t) => this.now() - t < 60_000);
    if (this.calls.length >= 12)
      return fallback(
        "We are pausing requests to respect the transport service. Please wait a minute.",
      );
    const from = LONDON_PLACES.find((p) => p.id === prefs.originId)!;
    const to = LONDON_PLACES.find((p) => p.id === destinationId)!;
    const url = new URL(
      `https://api.tfl.gov.uk/Journey/JourneyResults/${from.point}/to/${to.point}`,
    );
    url.searchParams.set("journeyPreference", "LeastInterchange");
    url.searchParams.set("mode", "tube,bus,walking");
    if (prefs.stepFree)
      url.searchParams.set("accessibilityPreference", "StepFreeToVehicle");
    this.calls.push(this.now());
    const work = (async () => {
      try {
        const response = await this.fetcher(url, {
          signal: AbortSignal.timeout(25000),
          redirect: "error",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`TfL returned ${response.status}`);
        const text = await response.text();
        if (text.length > 2_000_000)
          throw new Error("Unexpected provider response size");
        const result = parseJourneys(JSON.parse(text), prefs);
        const plan: JourneyPlan = {
          id: randomUUID(),
          source: "tfl",
          origin: from.name,
          destination: to.name,
          destinationId,
          fetchedAt: new Date(this.now()).toISOString(),
          stale: false,
          timeZone: "Europe/London",
          preferences: structuredClone(prefs),
          ...result,
          sourceUrl: url.toString(),
        };
        this.cache.set(key, { plan, at: this.now() });
        if (this.cache.size > 30)
          this.cache.delete(this.cache.keys().next().value!);
        this.failures.delete(key);
        return structuredClone(plan);
      } catch {
        this.failures.set(key, this.now() + 15_000);
        return fallback(
          "We could not refresh TfL journey information. These details must be checked again before travel.",
        );
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, work);
    return work;
  }
}
