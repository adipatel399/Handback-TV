import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createApplication } from "../server/app.js";
import { localDate, type Capability, type Task } from "../server/shared.js";

let app: Awaited<ReturnType<typeof createApplication>>,
  dir: string,
  adminToken: string;
const baseline = (): Capability => ({
  passenger: "Arun",
  pickup: "12 Willow Lane",
  allowedDestinations: ["library", "garden", "arts"],
  maxFare: 150,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  revision: 1,
  title: "My community shuttle",
});
const request = async (
  path: string,
  method = "GET",
  body?: unknown,
  token = adminToken,
) => {
  const r = await fetch(app.url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
};
const preview = async (dest = "library", day = 1) => {
  const r = await request("/api/tasks", "POST", {
    destinationId: dest,
    date: localDate(day),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data as Task;
};
const confirm = async (t: Task) =>
  request(`/api/tasks/${t.id}/confirm`, "POST", {
    confirmationToken: t.confirmationToken,
  });
const customHost = (path: string, host: string) =>
  new Promise<{ status: number; data: any }>((resolve, reject) => {
    http
      .get(app.url + path, { headers: { Host: host } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({ status: res.statusCode!, data: JSON.parse(body) }),
        );
      })
      .on("error", reject);
  });
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "handback-test-"));
  app = await createApplication({ dir, port: 0 });
  adminToken = app.store.get<string>("adminToken")!;
});
beforeEach(() => {
  app.provider.reset();
  app.store.resetTasks();
  app.store.set("capability", baseline());
});
after(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

test("state and task creation require a paired session", async () => {
  assert.equal((await request("/api/state", "GET", undefined, "")).status, 401);
  assert.equal(
    (
      await request(
        "/api/tasks",
        "POST",
        { destinationId: "library", date: localDate(1) },
        "",
      )
    ).status,
    401,
  );
});
test("one-use pairing creates a TV token without granting helper access", async () => {
  const pairing = app.store.renewPairing();
  const r = await request("/api/pair", "POST", { code: pairing.code }, "");
  assert.equal(r.status, 200);
  assert.equal(
    (await request("/api/state", "GET", undefined, r.data.token)).status,
    200,
  );
  assert.equal(
    (await request("/api/helper", "GET", undefined, r.data.token)).status,
    401,
  );
  assert.equal(
    (await request("/api/pair", "POST", { code: pairing.code }, "")).status,
    401,
  );
});
test("TV host cannot bootstrap the helper token", async () => {
  const r = await customHost(
    "/api/bootstrap?role=helper",
    `10.0.2.2:${new URL(app.url).port}`,
  );
  assert.equal(r.data.adminToken, undefined);
});
test("untrusted origins and DNS-rebinding hosts are rejected", async () => {
  assert.equal(
    (
      await fetch(app.url + "/api/health", {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await customHost("/api/health", "untrusted.example")).status,
    403,
  );
});
test("a reservation is only successful after exact stored receipt verification", async () => {
  const t = await preview();
  assert.equal(app.provider.list().length, 0);
  const r = await confirm(t);
  assert.equal(r.data.state, "verified", JSON.stringify(r.data));
  assert.equal(r.data.receipt.fare, t.terms.fare);
  assert.ok(r.data.receipt.verifiedAt);
  assert.equal(app.provider.list().length, 1);
  assert.ok(app.store.events().some((e) => e.kind === "verified"));
});
test("fare changes invalidate the original confirmation and require a fresh token", async () => {
  const t = await preview();
  app.provider.update({ fareDelta: 20 });
  const r = await confirm(t);
  assert.equal(r.data.state, "awaiting_confirmation");
  assert.equal(r.data.terms.fare, 100);
  assert.notEqual(r.data.confirmationToken, t.confirmationToken);
  assert.equal(app.provider.list().length, 0);
  assert.equal((await confirm(t)).status, 409);
  const result = await confirm(r.data);
  assert.equal(result.data.state, "verified");
  assert.equal(result.data.receipt.fare, 100);
});
test("a higher fare cannot bypass the helper spending limit", async () => {
  const t = await preview();
  app.provider.update({ fareDelta: 100 });
  const r = await confirm(t);
  assert.equal(r.data.state, "failed");
  assert.match(r.data.message, /limit/);
  assert.equal(app.provider.list().length, 0);
});
test("a stale confirmation time is refreshed without submitting", async () => {
  const t = await preview();
  t.expiresAt = new Date(Date.now() - 1000).toISOString();
  app.store.saveTask(t);
  const r = await confirm(t);
  assert.equal(r.data.state, "awaiting_confirmation");
  assert.equal(app.provider.list().length, 0);
  assert.notEqual(r.data.confirmationToken, t.confirmationToken);
});
test("concurrent and repeated confirmation cannot create duplicate bookings", async () => {
  const t = await preview();
  const results = await Promise.all([confirm(t), confirm(t), confirm(t)]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(app.provider.list().length, 1);
  const repeat = await confirm(t);
  assert.equal(repeat.data.state, "verified");
  assert.equal(app.provider.list().length, 1);
});
test("a lost submit response is reconciled through the provider history UI", async () => {
  const t = await preview();
  app.provider.update({ loseNextResponse: true });
  const r = await confirm(t);
  assert.equal(r.data.state, "verified");
  assert.equal(app.provider.list().length, 1);
  assert.equal(r.data.receipt.requestId, t.id);
});
test("unavailable history produces uncertainty, blocks new writes, and can be checked later", async () => {
  const t = await preview();
  app.provider.update({ loseNextResponse: true, hideHistory: true });
  const r = await confirm(t);
  assert.equal(r.data.state, "unknown");
  assert.equal(r.data.receipt, undefined);
  assert.equal(app.provider.list().length, 1);
  assert.equal(
    (
      await request("/api/tasks", "POST", {
        destinationId: "garden",
        date: localDate(2),
      })
    ).status,
    409,
  );
  const repeated = await confirm(t);
  assert.equal(repeated.data.state, "unknown");
  assert.equal(app.provider.list().length, 1);
  app.provider.update({ hideHistory: false });
  const checked = await request(`/api/tasks/${t.id}/check`, "POST", {});
  assert.equal(checked.data.state, "verified");
  assert.equal(app.provider.list().length, 1);
});
test("an earlier draft cannot bypass a different unresolved booking", async () => {
  const a = await preview();
  const b = await preview();
  app.provider.update({ hideHistory: true });
  await confirm(a);
  assert.equal((await confirm(b)).status, 409);
  assert.equal(app.provider.list().length, 1);
});
test("helper permissions cannot be mutated during an in-flight write", async () => {
  const t = await preview();
  t.state = "submitting";
  app.store.saveTask(t);
  const { revision, ...body } = baseline();
  assert.equal(
    (await request("/api/helper/capability", "PUT", body)).status,
    409,
  );
  assert.equal((await request("/api/helper/revoke", "POST", {})).status, 409);
});
test("a provider failure before submit is failed, not an unrecoverable unknown", async () => {
  const t = await preview();
  app.provider.update({ layout: "unsupported" });
  const r = await confirm(t);
  assert.equal(r.data.state, "failed");
  assert.equal(app.provider.list().length, 0);
  app.provider.update({ layout: "classic" });
  assert.equal((await preview()).state, "awaiting_confirmation");
});
test("changed helper permissions invalidate an earlier trip review", async () => {
  const t = await preview();
  app.store.set("capability", {
    ...baseline(),
    revision: 2,
    allowedDestinations: ["garden"],
  });
  const r = await confirm(t);
  assert.equal(r.status, 403);
  assert.equal(app.provider.list().length, 0);
});
test("expired capability and destinations outside scope are rejected", async () => {
  app.store.set("capability", {
    ...baseline(),
    allowedDestinations: ["garden"],
  });
  assert.equal(
    (
      await request("/api/tasks", "POST", {
        destinationId: "library",
        date: localDate(1),
      })
    ).status,
    403,
  );
  app.store.set("capability", {
    ...baseline(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  assert.equal(
    (
      await request("/api/tasks", "POST", {
        destinationId: "garden",
        date: localDate(1),
      })
    ).status,
    403,
  );
});
test("a draft can be cancelled; a stored booking cannot be falsely cancelled", async () => {
  const t = await preview();
  assert.equal(
    (await request(`/api/tasks/${t.id}/cancel`, "POST", {})).data.state,
    "cancelled",
  );
  assert.equal((await confirm(t)).status, 409);
  const next = await preview();
  await confirm(next);
  assert.equal(
    (await request(`/api/tasks/${next.id}/cancel`, "POST", {})).status,
    409,
  );
  assert.equal(app.provider.list().length, 1);
});
test("the provider atomically rejects an outdated quote and preserves request idempotency", () => {
  const input = {
    passenger: "Arun",
    pickup: "12 Willow Lane",
    destinationId: "library",
    date: localDate(1),
  };
  const q = app.provider.quote(input);
  app.provider.update({ fareDelta: 10 });
  assert.equal(
    "changed" in
      app.provider.book({
        ...q,
        requestId: "80b5f6a8-a6e1-45d9-8f89-d381ebda8e2a",
      }),
    true,
  );
  assert.equal(app.provider.list().length, 0);
  const fresh = app.provider.quote(input);
  const requestId = "80b5f6a8-a6e1-45d9-8f89-d381ebda8e2a";
  app.provider.book({ ...fresh, requestId });
  app.provider.book({ ...fresh, requestId });
  assert.equal(app.provider.list().length, 1);
});
test("the second supported portal layout completes the same verified workflow", async () => {
  app.provider.update({ layout: "modern" });
  const t = await preview("garden", 2);
  const r = await confirm(t);
  assert.equal(r.data.state, "verified");
  assert.equal(r.data.receipt.destinationId, "garden");
});
test("twenty representative destination/date cases read valid current terms", async () => {
  const results = [];
  for (let i = 0; i < 20; i++) {
    const destinationId = ["library", "garden", "arts"][i % 3];
    const started = performance.now();
    const t = await preview(destinationId, (i % 7) + 1);
    assert.equal(t.terms.destinationId, destinationId);
    assert.equal(t.terms.date, localDate((i % 7) + 1));
    assert.equal(t.state, "awaiting_confirmation");
    results.push({
      destinationId,
      date: t.terms.date,
      passed: true,
      durationMs: Math.round(performance.now() - started),
    });
  }
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/input-evaluation.json",
    JSON.stringify(
      {
        environment:
          "Real Playwright Chromium against the local reference provider",
        cases: results,
      },
      null,
      2,
    ),
  );
  assert.equal(app.provider.list().length, 0);
});
test("restarting after an interrupted submission preserves an unknown outcome", async () => {
  const t = await preview();
  t.state = "submitting";
  app.store.saveTask(t);
  await app.close();
  app = await createApplication({ dir, port: 0 });
  adminToken = app.store.get<string>("adminToken")!;
  assert.equal(app.store.task(t.id)?.state, "unknown");
  assert.equal(app.provider.list().length, 0);
});
