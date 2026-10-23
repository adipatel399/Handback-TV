import { _android as android } from "playwright";
import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const execFile = promisify(execFileCb),
  adb = resolve(".tools/android-sdk/platform-tools/adb");
const run = async (...args: string[]) =>
  (await execFile(adb, args)).stdout.trim();
const base = "http://127.0.0.1:4310",
  boot = await (await fetch(base + "/api/bootstrap?role=helper")).json();
const api = async (path: string, body: unknown) => {
  const r = await fetch(base + path, {
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
const device = (await android.devices()).find((d) =>
  d.serial().startsWith("emulator-"),
)!;
const page = await (await device.webView({ pkg: "com.handback.tv" })).page();
await api("/api/lab/reset", {});
await page.reload();
await page.waitForFunction(() =>
  document.querySelector("h1")?.textContent?.includes("Hello, Arun"),
);
await mkdir("artifacts/raw", { recursive: true });
const recorder = spawn(
  adb,
  [
    "shell",
    "screenrecord",
    "--bit-rate",
    "6000000",
    "--time-limit",
    "115",
    "/sdcard/handback-walkthrough.mp4",
  ],
  { stdio: "ignore" },
);
const start = Date.now();
const timeline: unknown[] = [];
const at = async (seconds: number, label: string, fn: () => Promise<void>) => {
  const wait = seconds * 1000 - (Date.now() - start);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await fn();
  timeline.push({
    atSeconds: Math.round((Date.now() - start) / 100) / 10,
    label,
  });
  console.log(label);
};
const key = async (code: number) => {
  await run("shell", "input", "keyevent", String(code));
};
const heading = async (text: string) =>
  page.waitForFunction(
    (t) => document.querySelector("h1")?.textContent?.includes(t),
    text,
    { timeout: 20000 },
  );
try {
  await at(8, "Choose the community garden", async () => {
    await key(22);
    await key(23);
    await heading("Community Garden");
  });
  await at(18, "Review the exact current trip", async () => {
    await key(20);
    await key(23);
    await heading("Does this look right?");
  });
  await at(
    33,
    "Confirm and independently verify the stored booking",
    async () => {
      await key(23);
      await heading("You’re going places");
    },
  );
  await at(49, "Begin a separate disclosed fare-change test", async () => {
    await key(23);
    await heading("Hello, Arun");
  });
  await at(54, "Choose the library", async () => {
    await key(23);
    await heading("Riverside Library");
  });
  await at(60, "Preview the usual library fare", async () => {
    await key(20);
    await key(23);
    await heading("Does this look right?");
  });
  await at(
    70,
    "Inject a twenty-rupee fare increase and attempt confirmation",
    async () => {
      await api("/api/lab", { fareDelta: 20 });
      await key(23);
      await page.waitForFunction(() =>
        document.body.textContent?.includes(
          "trip details or review time changed",
        ),
      );
    },
  );
  await at(87, "Confirm the updated terms", async () => {
    await key(23);
    await heading("You’re going places");
  });
  await at(102, "Open persisted trips", async () => {
    await key(23);
    await heading("Hello, Arun");
    await key(19);
    await key(22);
    await key(23);
    await heading("Your trips.");
  });
  await at(112, "Finish the emulator take", async () => {});
  await new Promise<void>((r, j) => {
    recorder.on("exit", (code) =>
      code === 0 ? r() : j(new Error(`screenrecord ${code}`)),
    );
  });
  await run(
    "pull",
    "/sdcard/handback-walkthrough.mp4",
    "artifacts/raw/handback-walkthrough.mp4",
  );
  await writeFile(
    "artifacts/raw/walkthrough-timeline.json",
    JSON.stringify(
      {
        source:
          "Actual Android TV emulator screenrecord, primary actions via Android D-pad",
        timeline,
      },
      null,
      2,
    ),
  );
  console.log("Actual emulator footage recorded.");
} finally {
  await device.close();
}
