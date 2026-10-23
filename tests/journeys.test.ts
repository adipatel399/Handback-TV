import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JourneyService, parseJourneys } from "../server/journeys.js";
import {
  DEFAULT_JOURNEY_PREFERENCES as prefs,
  londonClock,
} from "../server/journeys-shared.js";
import { createApplication } from "../server/app.js";
import { StudyRecorder } from "../server/study.js";
import { Store } from "../server/store.js";

import { sampleTfL } from "./fixtures/tfl.js";
const fakeFetch = (fn: (url: URL) => Response | Promise<Response>) =>
  (async (url: any) => fn(new URL(String(url)))) as typeof fetch;

test("live integration uses only allowlisted public stations, accessibility request, and coalesces/cache calls", async () => {
  let calls = 0,
    url: URL | undefined;
  const svc = new JourneyService(
    fakeFetch(async (u) => {
      calls++;
      url = u;
      await new Promise((r) => setTimeout(r, 15));
      return Response.json(sampleTfL);
    }),
  );
  const [a, b] = await Promise.all([
    svc.plan(prefs, "green-park"),
    svc.plan(prefs, "green-park"),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.id, b.id);
  assert.equal(url!.hostname, "api.tfl.gov.uk");
  assert.equal(
    url!.searchParams.get("accessibilityPreference"),
    "StepFreeToVehicle",
  );
  assert.equal(url!.searchParams.has("passenger"), false);
  assert.equal(a.options[0].walkingMinutes, 10);
  assert.equal(a.options[0].changes, 0);
  a.options[0].duration = 999;
  assert.equal((await svc.plan(prefs, "green-park")).options[0].duration, 22);
  assert.equal(calls, 1);
});
test("walking and change limits are never silently relaxed", () => {
  assert.equal(
    parseJourneys(sampleTfL, { ...prefs, maxWalkingMinutes: 9 }).options.length,
    0,
  );
  const raw = structuredClone(sampleTfL);
  raw.journeys[0].legs.splice(2, 0, { ...raw.journeys[0].legs[1] });
  assert.equal(
    parseJourneys(raw, { ...prefs, maxChanges: 0 }).options.length,
    0,
  );
  assert.equal(
    parseJourneys(raw, { ...prefs, maxChanges: 1 }).options.length,
    1,
  );
});
test("upstream failure returns visibly stale data for at most five minutes, then fails closed", async () => {
  let now = 1000000,
    failing = false,
    calls = 0;
  const svc = new JourneyService(
    fakeFetch(() => {
      calls++;
      return failing
        ? new Response("down", { status: 503 })
        : Response.json(sampleTfL);
    }),
    () => now,
  );
  const initial = await svc.plan(prefs, "green-park");
  failing = true;
  now += 61000;
  const stale = await svc.plan(prefs, "green-park");
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, initial.fetchedAt);
  await svc.plan(prefs, "green-park");
  assert.equal(calls, 2, "failure cooldown should avoid another request");
  now += 300000;
  await assert.rejects(() => svc.plan(prefs, "green-park"));
});
test("malformed provider responses, unsupported destinations, and redirects are not invented into routes", async () => {
  const svc = new JourneyService(
    fakeFetch(() => Response.json({ journeys: [{ legs: [] }] })),
  );
  await assert.rejects(() => svc.plan(prefs, "green-park"));
  await assert.rejects(() => svc.plan(prefs, "victoria"));
  assert.throws(() => parseJourneys({ journeys: [{ duration: -1 }] }, prefs));
});
test("London wall-clock times are preserved regardless of the laptop zone", () => {
  assert.equal(londonClock("2026-10-23T09:30:00"), "09:30");
  assert.equal(londonClock("bad"), "Time unavailable");
});
test("journey API requires pairing, validates settings, stores idempotently, and blocks saving after helper changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "handback-journeys-"));
  const app = await createApplication({
    dir,
    port: 0,
    journeyFetch: fakeFetch(() => Response.json(sampleTfL)),
  });
  const admin = app.store.get<string>("adminToken")!;
  const api = async (
    path: string,
    body?: unknown,
    method = "POST",
    authorized = true,
  ) =>
    fetch(app.url + path, {
      method,
      headers: {
        ...(authorized ? { Authorization: `Bearer ${admin}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal(
      (
        await api(
          "/api/journeys/plan",
          { destinationId: "green-park" },
          "POST",
          false,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await api(
          "/api/helper/journeys",
          { ...prefs, destinationIds: [prefs.originId] },
          "PUT",
        )
      ).status,
      400,
    );
    const plan = await (
      await api("/api/journeys/plan", { destinationId: "green-park" })
    ).json();
    const body = { planId: plan.id, optionId: plan.options[0].id };
    const first = await (await api("/api/journeys/save", body)).json();
    assert.equal(
      (await (await api("/api/journeys/save", body)).json()).id,
      first.id,
    );
    assert.equal(
      (await (await api("/api/journeys/saved", undefined, "GET")).json())
        .length,
      1,
    );
    await api(
      "/api/helper/journeys",
      { ...prefs, maxWalkingMinutes: 0 },
      "PUT",
    );
    assert.equal((await api("/api/journeys/save", body)).status, 409);
    assert.equal(
      app.provider.list().length,
      0,
      "real journey planning must never book the reference provider",
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("study observations distinguish automation, require consent, and cannot call assisted completion independent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "handback-study-"));
  const store = new Store(dir),
    study = new StudyRecorder(store);
  try {
    const s = study.start({
      kind: "automated",
      condition: "handback",
      task: "live-journey",
    });
    study.event(s.id, "remote", 12);
    study.event(s.id, "assistance");
    assert.throws(() =>
      study.start({
        kind: "human",
        condition: "baseline",
        task: "live-journey",
      }),
    );
    const end = study.finish(s.id, "independent");
    assert.equal(end.outcome, "assisted");
    assert.equal(end.remotePresses, 12);
    assert.equal(study.sessions().filter((x) => x.kind === "human").length, 0);
    assert.throws(() => study.event(s.id, "remote"));
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("fresh API requests are bounded even when preferences vary", async () => {
  let calls = 0;
  const service = new JourneyService(
    fakeFetch(() => {
      calls++;
      return Response.json(sampleTfL);
    }),
  );
  for (let i = 0; i < 12; i++)
    await service.plan({ ...prefs, maxWalkingMinutes: 20 + i }, "green-park");
  await assert.rejects(() =>
    service.plan({ ...prefs, maxWalkingMinutes: 40 }, "green-park"),
  );
  assert.equal(calls, 12);
});

test("updated helper limits invalidate an in-flight result and observation start requires explicit consent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "handback-race-"));
  let release: (() => void) | undefined, started: (() => void) | undefined;
  const fetched = new Promise<void>((r) => {
    started = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const app = await createApplication({
    dir,
    port: 0,
    journeyFetch: fakeFetch(async () => {
      started!();
      await gate;
      return Response.json(sampleTfL);
    }),
  });
  const admin = app.store.get<string>("adminToken")!;
  const api = (path: string, body: unknown, method = "POST") =>
    fetch(app.url + path, {
      method,
      headers: {
        Authorization: `Bearer ${admin}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  try {
    const pending = api("/api/journeys/plan", { destinationId: "green-park" });
    await fetched;
    await api(
      "/api/helper/journeys",
      { ...prefs, maxWalkingMinutes: 0 },
      "PUT",
    );
    release!();
    assert.equal((await pending).status, 409);
    assert.equal(
      (
        await api("/api/helper/study/start", {
          kind: "human",
          condition: "handback",
          task: "live-journey",
          consent: false,
        })
      ).status,
      400,
    );
    assert.equal(app.store.get<any[]>("studySessions"), undefined);
  } finally {
    release!();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "local speech requires pairing, generates actual WAV bytes, and exposes only an expiring media capability",
  { skip: process.platform !== "darwin" },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "handback-voice-test-"));
    const app = await createApplication({ dir, port: 0 });
    const admin = app.store.get<string>("adminToken")!;
    try {
      const unauthorized = await fetch(app.url + "/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "A short route." }),
      });
      assert.equal(unauthorized.status, 401);
      const response = await fetch(app.url + "/api/voice", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${admin}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Your route is ready." }),
      });
      assert.equal(response.status, 200);
      const clip = await response.json();
      assert.match(clip.path, /^\/api\/voice\/[a-f0-9]{32}$/);
      const audio = await fetch(app.url + clip.path);
      assert.match(audio.headers.get("content-type") || "", /audio\/wav/);
      const bytes = Buffer.from(await audio.arrayBuffer());
      assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString(), "WAVE");
      assert.equal(
        (await fetch(app.url + "/api/voice/not-a-clip")).status,
        404,
      );
    } finally {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
