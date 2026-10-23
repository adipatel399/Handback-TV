import test from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server/app.js";
import { validateCloudAccess } from "../server/cloud-access.js";
const origin = "https://handback.example.test",
  password = "a-strong-test-only-preview-password-42";

test("cloud mode rejects weak credentials and non-HTTPS origins", () => {
  assert.throws(() =>
    validateCloudAccess({ publicOrigin: "http://example.test", password }),
  );
  assert.throws(() =>
    validateCloudAccess({ publicOrigin: origin, password: "weak" }),
  );
  assert.throws(() =>
    validateCloudAccess({ publicOrigin: origin + "/helper", password }),
  );
});

test("cloud preview protects bootstrap and data, authenticates cookie sessions, and retains internal browser access", async () => {
  const dir = await mkdtemp(join(tmpdir(), "handback-cloud-"));
  const app = await createApplication({
    dir,
    port: 0,
    cloud: { publicOrigin: origin, password },
  });
  const req = (path: string, init: RequestInit = {}) =>
    new Promise<Response>((resolve, reject) => {
      const request = httpRequest(
        app.url + path,
        {
          method: init.method || "GET",
          headers: {
            Host: "handback.example.test",
            ...((init.headers as Record<string, string>) || {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(response.headers))
              if (value)
                headers.set(key, Array.isArray(value) ? value[0] : value);
            resolve(
              new Response(Buffer.concat(chunks), {
                status: response.statusCode,
                headers,
              }),
            );
          });
        },
      );
      request.on("error", reject);
      request.end(init.body?.toString());
    });
  try {
    const anonymous = await req("/api/bootstrap?role=helper");
    assert.equal(anonymous.status, 401);
    assert.equal((await anonymous.text()).includes("adminToken"), false);
    assert.equal((await req("/api/state")).status, 401);
    assert.equal((await req("/provider/api/history")).status, 401);
    const page = await req("/helper");
    assert.equal(page.status, 303);
    assert.equal(page.headers.get("referrer-policy"), "same-origin");
    assert.match(page.headers.get("location")!, /auth\/login/);
    const csrf = await req("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: new URLSearchParams({ password }),
    });
    assert.equal(csrf.status, 403);
    const bad = await req("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: origin,
      },
      body: new URLSearchParams({ password: "incorrect" }),
    });
    assert.equal(bad.status, 401);
    const login = await req("/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: origin,
      },
      body: new URLSearchParams({ password, next: "https://evil.example" }),
    });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get("location"), "/tv/journeys");
    const set = login.headers.get("set-cookie")!;
    assert.match(set, /HttpOnly/);
    assert.match(set, /Secure/);
    assert.match(set, /SameSite=Strict/);
    const cookie = set.split(";")[0];
    const boot = await req("/api/bootstrap?role=helper", {
      headers: { Cookie: cookie },
    });
    assert.equal(boot.status, 200);
    const data = await boot.json();
    assert.ok(data.adminToken);
    assert.ok(data.previewToken);
    assert.equal(data.deploymentMode, "cloud-preview");
    const state = await req("/api/state", {
      headers: { Cookie: cookie, Authorization: `Bearer ${data.adminToken}` },
    });
    assert.equal(state.status, 200);
    const forged = await req("/api/bootstrap?role=helper", {
      headers: { Cookie: cookie.slice(0, -1) + "X" },
    });
    assert.equal(forged.status, 401);
    const localProvider = await fetch(app.url + "/provider/api/config");
    assert.equal(
      localProvider.status,
      200,
      "Loopback browser adapter must retain local access",
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
