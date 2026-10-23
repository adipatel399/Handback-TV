import { _android as android } from "playwright";
import { execFile as cb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const exec = promisify(cb),
  adb = resolve(".tools/android-sdk/platform-tools/adb");
const run = async (...args: string[]) => (await exec(adb, args)).stdout.trim();
const boot = await (
  await fetch("http://127.0.0.1:4310/api/bootstrap?role=helper")
).json();
const api = async (path: string, body: unknown) => {
  const r = await fetch("http://127.0.0.1:4310" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${boot.adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
const d = (await android.devices()).find((d) =>
  d.serial().startsWith("emulator-"),
)!;
const p = await (await d.webView({ pkg: "com.handback.tv" })).page();
await api("/api/lab/reset", {});
await api("/api/journeys/plan", { destinationId: "green-park" }); // Warm the explicit 60-second cache, retaining real fetchedAt.
await p.goto("http://10.0.2.2:4310/tv/journeys");
const heading = (text: string) =>
  p.waitForFunction(
    (t) => document.querySelector("h1")?.textContent?.includes(t),
    text,
    { timeout: 30000 },
  );
await heading("Where shall we go");
await mkdir("artifacts/raw", { recursive: true });
const recorder = spawn(
  adb,
  [
    "shell",
    "screenrecord",
    "--bit-rate",
    "6000000",
    "--time-limit",
    "130",
    "/sdcard/handback-upgrade.mp4",
  ],
  { stdio: "ignore" },
);
const recordingDone = new Promise<void>((r, reject) =>
  recorder.on("exit", (code) =>
    code === 0 ? r() : reject(new Error(`screenrecord ${code}`)),
  ),
);
const started = Date.now(),
  timeline: unknown[] = [];
const key = (code: number) => run("shell", "input", "keyevent", String(code));
const at = async (seconds: number, label: string, fn: () => Promise<void>) => {
  const remaining = seconds * 1000 - (Date.now() - started);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  await fn();
  timeline.push({ at: Math.round((Date.now() - started) / 100) / 10, label });
  console.log(label);
};
try {
  await at(8, "Choose Green Park with the remote", async () => {
    await key(23);
    await heading("Green Park");
  });
  await at(19, "Review a real TfL route", async () => {
    await key(23);
    await heading("Your route to Green Park");
  });
  await at(28, "Show one step at a time", async () => {
    await key(23);
    await p.waitForFunction(() =>
      document.body.textContent?.includes("STEP 1 OF"),
    );
  });
  await at(37, "Show the transport direction", async () => {
    await key(23);
  });
  await at(41, "Read the current instruction aloud", async () => {
    await key(85);
  });
  await at(46, "Stop reading without confirming anything", async () => {
    await key(85);
  });
  await at(51, "Review the final walking step", async () => {
    await key(23);
  });
  await at(59, "Save the reviewed route locally", async () => {
    await key(23);
    await heading("Your route is saved");
  });
  await at(67, "Reopen saved routes", async () => {
    await key(23);
    await heading("Your saved routes");
  });
  await at(
    76,
    "Begin a separate clearly labelled fictional booking lab",
    async () => {
      await p.goto("http://10.0.2.2:4310/tv");
      await heading("Hello, Arun");
    },
  );
  await at(83, "Choose the fictional library shuttle", async () => {
    await key(23);
    await heading("Riverside Library");
  });
  await at(90, "Preview the exact reference booking", async () => {
    await key(20);
    await key(23);
    await heading("Does this look right");
  });
  await at(
    100,
    "Disclosed fare-change injection rejects the old confirmation",
    async () => {
      await api("/api/lab", { fareDelta: 20 });
      await key(23);
      await p.waitForFunction(() =>
        document.body.textContent?.includes(
          "trip details or review time changed",
        ),
      );
    },
  );
  await at(
    114,
    "Fresh confirmation and independently verified reference receipt",
    async () => {
      await key(23);
      await heading("You’re going places");
    },
  );
  await recordingDone;
  await run(
    "pull",
    "/sdcard/handback-upgrade.mp4",
    "artifacts/raw/handback-upgrade.mp4",
  );
  await writeFile(
    "artifacts/raw/upgrade-timeline.json",
    JSON.stringify(
      {
        source:
          "Actual Android TV emulator; primary actions via native D-pad and Play/Pause. Explicit section navigation at 76s; fare fault injected through local lab API.",
        timeline,
      },
      null,
      2,
    ),
  );
  console.log("Upgraded demonstration take saved.");
} finally {
  await d.close();
}
