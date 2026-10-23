import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server/app.js";
import { sampleTfL } from "../tests/fixtures/tfl.js";
const dir = await mkdtemp(join(tmpdir(), "handback-live-ui-"));
const app = await createApplication({
  dir,
  port: 0,
  journeyFetch: (async () => Response.json(sampleTfL)) as typeof fetch,
});
const browser = await chromium.launch(),
  context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const tv = await context.newPage(),
  helper = await context.newPage();
const errors: string[] = [];
tv.on("pageerror", (e) => errors.push(e.message));
helper.on("pageerror", (e) => errors.push(e.message));
const fits = async () =>
  assert.ok(
    await tv.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
    "960x540 layout overflows",
  );
try {
  await mkdir("artifacts/screenshots", { recursive: true });
  await tv.goto(app.url + "/tv/journeys");
  await tv.getByLabel("Pairing code").fill(app.store.get<any>("pairing").code);
  await tv.getByRole("button", { name: "Connect my TV" }).click();
  await tv.getByRole("heading", { name: /Where shall we go/ }).waitFor();
  await fits();
  await tv.keyboard.press("Enter");
  await tv.getByRole("heading", { name: "Green Park", exact: true }).waitFor();
  await fits();
  await tv.keyboard.press("Enter");
  await tv
    .getByRole("heading", { name: "Your route to Green Park." })
    .waitFor();
  await fits();
  for (let i = 0; i < 3; i++) {
    await tv.keyboard.press("Enter");
    await tv.getByText(`STEP ${i + 1} OF 3`, { exact: true }).waitFor();
    await fits();
  }
  await tv.keyboard.press("Enter");
  await tv.getByRole("heading", { name: "Your route is saved." }).waitFor();
  await fits();
  assert.equal((app.store.get<any[]>("savedJourneys") || []).length, 1);
  assert.equal(app.provider.list().length, 0);
  await tv.getByRole("button", { name: "See my saved routes" }).click();
  await tv.getByRole("heading", { name: "Your saved routes." }).waitFor();
  await fits();
  await helper.goto(app.url + "/helper");
  await helper
    .getByRole("button", { name: "Live journeys", exact: true })
    .click();
  await helper.getByLabel("Maximum total walking (minutes)").fill("0");
  await helper.getByRole("button", { name: "Save journey settings" }).click();
  await helper
    .getByText("Journey settings saved. The TV updates automatically.")
    .waitFor();
  await tv.getByRole("button", { name: /Green Park.*Check again/ }).click();
  await tv
    .getByRole("heading", { name: "No returned route fits your limits." })
    .waitFor();
  await fits();
  await helper
    .getByRole("button", { name: "Usability sessions", exact: true })
    .click();
  await helper
    .getByText("No participant results yet.", { exact: false })
    .waitFor();
  await helper
    .getByRole("combobox", { name: "Who is testing?" })
    .selectOption("automated");
  await helper.getByLabel("The participant agreed", { exact: false }).check();
  await helper.getByRole("button", { name: "Start timer" }).click();
  await helper
    .getByRole("heading", { name: "Observation in progress" })
    .waitFor();
  await tv
    .getByText(/Observation active · automated/)
    .waitFor({ timeout: 10000 });
  await tv.keyboard.press("ArrowUp");
  await helper.getByRole("button", { name: "Record assistance" }).click();
  await helper.getByRole("button", { name: "Completed independently" }).click();
  await helper.getByRole("heading", { name: "Start an observation" }).waitFor();
  const sessions = app.store.get<any[]>("studySessions")!;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].kind, "automated");
  assert.equal(sessions[0].outcome, "assisted");
  assert.ok(sessions[0].remotePresses > 0);
  assert.equal(sessions.filter((s) => s.kind === "human").length, 0);
  await writeFile(
    "artifacts/journey-ui-verification.json",
    JSON.stringify(
      {
        passed: true,
        data: "synthetic deterministic fixture; separate live smoke verifies TfL",
        viewport: "960x540",
        checks: [
          "pairing",
          "remote-only route choice and every step",
          "local save without reservation",
          "saved route refresh",
          "helper walking limits never relaxed",
          "opt-in study session",
          "automation excluded from human evidence",
          "assisted outcome cannot be labelled independent",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Live journey UI and observation verification passed.");
} finally {
  await browser.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
