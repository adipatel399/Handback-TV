import { _android as android } from "playwright";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const execFile = promisify(execFileCb);
const adb = resolve(".tools/android-sdk/platform-tools/adb");
const run = async (...args: string[]) =>
  (await execFile(adb, args)).stdout.trim();
const base = "http://127.0.0.1:4310";
const boot = await (await fetch(base + "/api/bootstrap?role=helper")).json();
const admin = boot.adminToken;
const call = async (path: string, method = "GET", body?: unknown) => {
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${admin}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
await call("/api/lab/reset", "POST", {});
await mkdir("artifacts/screenshots", { recursive: true });
await mkdir("artifacts/raw", { recursive: true });
const pid = await run("shell", "pidof", "com.handback.tv");
await run(
  "forward",
  "tcp:9223",
  `localabstract:webview_devtools_remote_${pid}`,
);
const devices = await android.devices();
const device = devices.find((d) => d.serial().startsWith("emulator-"))!;
assert.ok(device, "Android TV emulator is not connected.");
const webview = await device.webView({ pkg: "com.handback.tv" });
const page = await webview.page();
assert.ok(page, "Handback TV WebView is not running.");
await page.goto("http://10.0.2.2:4310/tv");
const previousToken = await page.evaluate(() =>
  localStorage.getItem("handback-tv-token"),
);
const pairing = await call("/api/helper/pairing", "POST", {});
// Exercise the actual native Menu and pairing dialog, including its WebView bridge.
// Standard ADB input avoids the optional legacy Playwright Android driver APK.
const nativeTree = async () => {
  await run("shell", "uiautomator", "dump", "/sdcard/handback-test-window.xml");
  return run("shell", "cat", "/sdcard/handback-test-window.xml");
};
const tapNative = async (match: string) => {
  const xml = await nativeTree();
  const tag = xml.match(new RegExp(`<node[^>]*${match}[^>]*>`))?.[0];
  assert.ok(tag, `Native control missing: ${match}`);
  const bounds = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  assert.ok(bounds, "Native control has no bounds");
  const [, x1, y1, x2, y2] = bounds.map(Number);
  await run(
    "shell",
    "input",
    "tap",
    String(Math.round((x1 + x2) / 2)),
    String(Math.round((y1 + y2) / 2)),
  );
};
await run("shell", "input", "keyevent", "82");
await tapNative('text="Pair television"');
assert.match(
  await nativeTree(),
  /class="android.widget.EditText"[^>]*focused="true"/,
);
await run("shell", "input", "text", pairing.code);
await tapNative('resource-id="android:id/button1"');
await page.waitForFunction(
  (old) =>
    !!localStorage.getItem("handback-tv-token") &&
    localStorage.getItem("handback-tv-token") !== old,
  previousToken,
  { timeout: 20000 },
);
assert.equal(
  (await call("/api/helper")).pairing.used,
  true,
  "Native pairing did not consume the code",
);
await page.waitForFunction(
  () => document.querySelector("h1")?.textContent?.includes("Hello, Arun"),
  {},
  { timeout: 20000 },
);
const dimensions = await page.evaluate(() => ({
  width: innerWidth,
  height: innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
}));
console.log("WebView viewport", dimensions);
const screenshot = async (name: string) => {
  const r = await execFile(adb, ["exec-out", "screencap", "-p"], {
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });
  await writeFile(`artifacts/screenshots/${name}.png`, r.stdout);
};
await screenshot("emulator-home");
// All primary workflow actions below are Android D-pad / Select input events.
await run("shell", "input", "keyevent", "22");
await page.waitForFunction(() =>
  document.activeElement?.textContent?.includes("Community Garden"),
);
await run("shell", "input", "keyevent", "23");
await page.waitForFunction(
  () => document.querySelector("h1")?.textContent === "Community Garden",
);
await screenshot("emulator-choose-day");
await page.waitForFunction(() =>
  document.activeElement?.classList.contains("date-choice"),
);
await run("shell", "input", "keyevent", "20");
await page.waitForFunction(() =>
  document.activeElement?.textContent?.includes("Review my trip"),
);
await run("shell", "input", "keyevent", "23");
await page.waitForFunction(
  () => document.querySelector("h1")?.textContent === "Does this look right?",
);
await screenshot("emulator-review");
await page.waitForFunction(() =>
  document.activeElement?.textContent?.includes("Yes, book this trip"),
);
await run("shell", "input", "keyevent", "23");
await page.waitForFunction(
  () =>
    document.querySelector("h1")?.textContent?.includes("You’re going places"),
  {},
  { timeout: 20000 },
);
assert.ok(
  await page.evaluate(() =>
    document.body.textContent?.includes("Reservation verified"),
  ),
);
await screenshot("emulator-verified");
const state = await call("/api/state");
assert.equal(state.tasks.filter((t: any) => t.state === "verified").length, 1);
await writeFile(
  "artifacts/emulator-verification.json",
  JSON.stringify(
    {
      passed: true,
      device: "Android TV API 33 arm64-v8a",
      package: "com.handback.tv",
      viewport: dimensions,
      primaryInputs:
        "Android KEYCODE_DPAD_RIGHT, KEYCODE_DPAD_DOWN, KEYCODE_DPAD_CENTER",
      setup:
        "Actual native Menu → Pair television dialog, native text entry, Pair button, and WebView bridge",
      receipt: state.tasks[0].receipt,
    },
    null,
    2,
  ),
);
console.log(
  "Native emulator verification passed: actual APK, Android D-pad input, stored and verified booking.",
);
// Disconnect from this test's CDP connection; keep the user-facing emulator running.
await device.close();
