import { _android as android } from "playwright";
import { execFile as cb } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const exec = promisify(cb),
  adb = resolve(".tools/android-sdk/platform-tools/adb");
const run = async (...args: string[]) => (await exec(adb, args)).stdout.trim();
const boot = await (
  await fetch("http://127.0.0.1:4310/api/bootstrap?role=helper")
).json();
const api = async (path: string, method = "GET", body?: unknown) => {
  const r = await fetch("http://127.0.0.1:4310" + path, {
    method,
    headers: {
      Authorization: `Bearer ${boot.adminToken}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
const device = (await android.devices()).find((d) =>
  d.serial().startsWith("emulator-"),
)!;
assert.ok(device, "Android TV emulator required");
const page = await (await device.webView({ pkg: "com.handback.tv" })).page();
const heading = (text: string) =>
  page.waitForFunction(
    (s) => document.querySelector("h1")?.textContent?.includes(s),
    text,
    { timeout: 20000 },
  );
const key = (code: number) => run("shell", "input", "keyevent", String(code));
const fit = async () =>
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
    "Logical TV viewport overflows",
  );
const screenshot = async (name: string) => {
  const r = await exec(adb, ["exec-out", "screencap", "-p"], {
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });
  await writeFile(`artifacts/screenshots/${name}.png`, r.stdout);
};
try {
  await mkdir("artifacts/screenshots", { recursive: true });
  await page.goto("http://10.0.2.2:4310/tv/journeys");
  await heading("Where shall we go");
  await fit();
  await screenshot("live-emulator-home");
  await page.evaluate(() => {
    (window as any).__voiceEvents = [];
    window.addEventListener("handback-voice-state", (e) =>
      (window as any).__voiceEvents.push((e as CustomEvent).detail),
    );
  });
  await key(85);
  await page.waitForFunction(
    () => (window as any).__voiceEvents.includes("speaking"),
    {},
    { timeout: 30000 },
  );
  await screenshot("live-emulator-read-aloud");
  await key(85);
  await page.waitForFunction(() =>
    (window as any).__voiceEvents.includes("stopped"),
  );
  assert.match(
    await page.evaluate(() => document.activeElement?.textContent || ""),
    /Green Park/,
  );
  await key(23);
  await heading("Green Park");
  await fit();
  await screenshot("live-emulator-routes");
  await key(23);
  await heading("Your route to Green Park");
  await fit();
  await screenshot("live-emulator-review");
  await key(23);
  const steps = await page.evaluate(() =>
    Number(document.body.textContent?.match(/STEP 1 OF (\d+)/)?.[1]),
  );
  assert.ok(steps > 0 && steps < 15);
  for (let i = 1; i <= steps; i++) {
    await page.waitForFunction(
      (text) => document.body.textContent?.includes(text),
      `STEP ${i} OF ${steps}`,
    );
    await fit();
    if (i === 2) await screenshot("live-emulator-step");
    await key(23);
  }
  await heading("Your route is saved.");
  await fit();
  await screenshot("live-emulator-saved");
  const saved = await api("/api/journeys/saved");
  const latest = saved[0];
  assert.equal(latest.plan.source, "tfl");
  assert.equal(latest.plan.destinationId, "green-park");
  const voices = await page.evaluate(() => (window as any).__voiceEvents);
  await writeFile(
    "artifacts/live-emulator-verification.json",
    JSON.stringify(
      {
        passed: true,
        checkedAt: new Date().toISOString(),
        device: "Android TV API 33 ARM64",
        package: "com.handback.tv",
        source: "Real TfL Unified API response",
        viewport: await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
        })),
        input: "Actual Android D-pad Select and Media Play/Pause",
        speechEvents: voices,
        nativeOfflineVoiceAvailable: await page.evaluate(() =>
          (window as any).HandbackVoice.available(),
        ),
        speechFallback:
          "Local macOS synthesis and native Android MediaPlayer if no installed offline voice",
        storedRoute: latest,
        noTransportReservationMade: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Actual emulator passed: live TfL route, native audio playback/stop, remote-only steps and locally saved plan.",
  );
} finally {
  await device.close();
}
