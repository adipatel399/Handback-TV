import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server/app.js";

const dir = await mkdtemp(join(tmpdir(), "handback-ui-"));
const app = await createApplication({ dir, port: 0 });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const helper = await context.newPage(),
  tv = await context.newPage();
const errors: string[] = [];
for (const p of [helper, tv]) p.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts/screenshots", { recursive: true });
try {
  await helper.goto(app.url + "/helper");
  await helper
    .getByRole("heading", { name: "Connect their television" })
    .waitFor();
  await helper.screenshot({
    path: "artifacts/screenshots/helper-overview.png",
    fullPage: true,
  });
  await tv.setViewportSize({ width: 1600, height: 900 });
  await tv.goto(app.url + "/tv");
  await tv.getByLabel("Pairing code").fill(app.store.get<any>("pairing").code);
  await tv.getByRole("button", { name: "Connect my TV" }).click();
  await tv.getByRole("heading", { name: /Hello, Arun/ }).waitFor();
  await tv.screenshot({ path: "artifacts/screenshots/tv-home.png" });
  await tv.keyboard.press("ArrowRight");
  assert.match(
    await tv.evaluate(() => document.activeElement?.textContent || ""),
    /Community Garden/,
  );
  await tv.keyboard.press("Enter");
  await tv
    .getByRole("heading", { name: "Community Garden", exact: true })
    .waitFor();
  await tv.screenshot({ path: "artifacts/screenshots/tv-choose-day.png" });
  await tv.getByRole("button", { name: "Review my trip" }).click();
  await tv.getByRole("heading", { name: "Does this look right?" }).waitFor();
  await tv.screenshot({ path: "artifacts/screenshots/tv-review.png" });
  await tv.getByRole("button", { name: "Yes, book this trip" }).click();
  await tv.getByRole("heading", { name: /You’re going places/ }).waitFor();
  assert.equal(app.provider.list().length, 1);
  assert.ok(
    await tv.getByText("Reservation verified", { exact: true }).isVisible(),
  );
  await tv.screenshot({ path: "artifacts/screenshots/tv-verified.png" });
  await tv.reload();
  await tv.getByRole("heading", { name: /Hello, Arun/ }).waitFor();
  await tv.getByRole("button", { name: /My trips/ }).click();
  await tv.getByRole("heading", { name: "Your trips." }).waitFor();
  await tv.getByRole("button", { name: /Community Garden/ }).click();
  await tv.getByRole("heading", { name: /You’re going places/ }).waitFor();
  assert.equal(app.provider.list().length, 1);
  await helper
    .getByRole("button", { name: "Supported task", exact: true })
    .click();
  await helper.getByLabel("Name on the trip").fill("Mira");
  await helper
    .locator(".allowed-places label")
    .filter({ hasText: "The Arts Centre" })
    .getByRole("checkbox")
    .uncheck();
  await helper.getByRole("button", { name: "Save supported task" }).click();
  await helper.getByRole("status").waitFor();
  await helper.screenshot({
    path: "artifacts/screenshots/helper-task.png",
    fullPage: true,
  });
  await tv.getByRole("button", { name: "Back to my day" }).click();
  await tv.getByRole("heading", { name: /Hello, Mira/ }).waitFor();
  assert.equal(
    await tv.getByRole("button", { name: /The Arts Centre/ }).count(),
    0,
  );
  await tv.getByRole("button", { name: /Riverside Library/ }).click();
  await tv.getByRole("button", { name: "Review my trip" }).click();
  await tv.getByRole("heading", { name: "Does this look right?" }).waitFor();
  await helper
    .getByRole("button", { name: "Demo controls", exact: true })
    .click();
  await helper.getByRole("button", { name: "Raise fare by ₹20" }).click();
  await helper.getByRole("status").waitFor();
  await tv.getByRole("button", { name: "Yes, book this trip" }).click();
  await tv.getByText(/trip details or review time changed/).waitFor();
  assert.equal(app.provider.list().length, 1);
  await tv.screenshot({ path: "artifacts/screenshots/tv-changed-fare.png" });
  await tv.getByRole("button", { name: "Yes, book this trip" }).click();
  await tv.getByRole("heading", { name: /You’re going places/ }).waitFor();
  assert.equal(app.provider.list().length, 2);
  assert.deepEqual(errors, []);
  // The UI must also fit a TV WebView's logical 960×540 viewport.
  await tv.setViewportSize({ width: 960, height: 540 });
  await tv.getByRole("button", { name: "Back to my day" }).click();
  await tv.getByRole("heading", { name: /Hello, Mira/ }).waitFor();
  const fits = await tv.evaluate(() => ({
    width: document.documentElement.scrollWidth <= window.innerWidth,
    height: document.documentElement.scrollHeight <= window.innerHeight,
  }));
  assert.equal(fits.width, true, "TV interface has horizontal overflow");
  assert.equal(fits.height, true, "TV interface has vertical overflow");
  await tv.route("**/api/**", (route) => route.abort());
  await tv
    .getByRole("heading", { name: "Your connection is resting." })
    .waitFor({ timeout: 10000 });
  await tv.unroute("**/api/**");
  await tv
    .getByRole("heading", { name: /Hello, Mira/ })
    .waitFor({ timeout: 10000 });
  assert.equal(
    app.provider.list().length,
    2,
    "Reconnection must not resubmit a booking",
  );
  await writeFile(
    "artifacts/ui-verification.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "real helper pairing",
          "D-pad navigation",
          "complete verified booking",
          "persisted trip after reload",
          "helper settings update TV without code edits",
          "changed fare requires new confirmation",
          "960x540 TV viewport fits",
          "service disconnect and reconnection without another write",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "UI verification passed: pairing, remote focus, booking, persistence, helper changes, changed fares, and viewport.",
  );
} finally {
  await browser.close();
  await app.close();
  await rm(dir, { recursive: true, force: true });
}
