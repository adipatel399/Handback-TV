import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const state = JSON.parse(await readFile(".tools/azure/state.json", "utf8"));
const origin = state.url as string;
assert.equal((await fetch(origin + "/api/bootstrap?role=helper")).status, 401);
assert.equal((await fetch(origin + "/provider/api/history")).status, 401);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(origin + "/tv/journeys");
  await page.getByLabel("Preview password").fill(state.password);
  await page.getByRole("button", { name: "Open Handback" }).click();
  await page
    .getByRole("heading", { name: /Where shall we go/ })
    .waitFor({ timeout: 30000 });
  const cookie = (await context.cookies()).find(
    (c) => c.name === "handback_owner",
  )!;
  assert.ok(cookie.httpOnly && cookie.secure && cookie.sameSite === "Strict");
  const bootstrap = await (
    await context.request.get(origin + "/api/bootstrap?role=helper")
  ).json();
  assert.equal(bootstrap.deploymentMode, "cloud-preview");
  assert.ok(bootstrap.previewToken);
  const admin = bootstrap.adminToken;
  const api = async (path: string, method = "GET", body?: unknown) => {
    const r = await context.request.fetch(origin + path, {
      method,
      headers: { Authorization: `Bearer ${admin}` },
      ...(body ? { data: body } : {}),
    });
    if (!r.ok()) throw new Error(await r.text());
    return r.json();
  };
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.screenshot({
    path: "artifacts/screenshots/azure-live-home.png",
    fullPage: true,
  });
  const clip = await api("/api/voice", "POST", {
    text: "Your real journey to Green Park. One clear step at a time.",
  });
  const audio = await context.request.get(origin + clip.path);
  assert.equal((await audio.body()).subarray(0, 4).toString(), "RIFF");
  assert.equal(clip.engine, "local eSpeak NG");
  await page.getByRole("button", { name: /01 Green Park/ }).click();
  await page
    .getByRole("heading", { name: "Green Park", exact: true })
    .waitFor({ timeout: 35000 });
  await page.locator(".route-option").first().click();
  await page
    .getByRole("button", { name: "Show me one step at a time" })
    .click();
  const steps = Number(
    (await page.locator(".step-layout .eyebrow").innerText()).match(
      /OF (\d+)/,
    )?.[1],
  );
  assert.ok(steps > 0 && steps < 20);
  for (let step = 1; step < steps; step++)
    await page
      .getByRole("button", { name: "Next step →", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Save this route", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your route is saved." }).waitFor();
  await page.screenshot({
    path: "artifacts/screenshots/azure-route-saved.png",
    fullPage: true,
  });
  const saved = await api("/api/journeys/saved");
  assert.equal(saved[0].plan.source, "tfl");
  await page.goto(origin + "/tv");
  await page.getByRole("heading", { name: /Hello, Arun/ }).waitFor();
  await page.getByRole("button", { name: /Riverside Library/ }).click();
  await page.getByRole("button", { name: "Review my trip" }).click();
  await page
    .getByRole("heading", { name: "Does this look right?" })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Yes, book this trip" }).click();
  await page
    .getByRole("heading", { name: /You’re going places/ })
    .waitFor({ timeout: 30000 });
  assert.ok(
    await page.getByText("Reservation verified", { exact: true }).isVisible(),
  );
  await page.screenshot({
    path: "artifacts/screenshots/azure-reference-receipt.png",
    fullPage: true,
  });
  await page.goto(origin + "/helper");
  await page
    .getByRole("heading", { name: "Connect their television" })
    .waitFor();
  await page
    .locator(".sidebar-note p")
    .filter({ hasText: "Hosted private preview." })
    .waitFor();
  await page
    .getByText("Sign in on the TV with the private preview password.", {
      exact: true,
    })
    .waitFor();
  await page.screenshot({
    path: "artifacts/screenshots/azure-helper.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/azure-verification.json",
    JSON.stringify(
      {
        passed: true,
        checkedAt: new Date().toISOString(),
        url: origin,
        checks: [
          "public HTTPS certificate validated",
          "anonymous helper bootstrap and booking history blocked",
          "private login and secure HttpOnly SameSite session",
          "authenticated TV opens without laptop pairing",
          "actual Linux speech returns WAV",
          "real TfL journey on Azure",
          "local persistent route save",
          "Playwright reference booking and stored receipt on Azure",
          "helper dashboard",
        ],
        speechEngine: clip.engine,
        browserErrors: errors,
        caveat:
          "Private single-household preview with shared reviewer access; this is functional verification, not target-user validation.",
      },
      null,
      2,
    ),
  );
  console.log(
    "Azure HTTPS, private access, Linux speech, real journey and reference booking checks passed.",
  );
} finally {
  await browser.close();
}
