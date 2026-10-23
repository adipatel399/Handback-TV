import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { localDate } from "../server/shared.js";
await mkdir("artifacts/rea", { recursive: true });
const input = {
  browser: { mode: "launch", executable_path: chromium.executablePath() },
  start_url: {
    url: `http://127.0.0.1:4310/provider/book?passenger=Arun&pickup=12%20Willow%20Lane&destinationId=library&date=${localDate(1)}`,
  },
  actions: [
    {
      step_id: "review-current-trip",
      action: "click",
      locator: { kind: "css", selector: ".provider-form button" },
      timeout_ms: 10000,
    },
    {
      step_id: "quote-visible",
      action: "wait_for",
      locator: { kind: "css", selector: '[data-testid="provider-quote"]' },
      state: "visible",
      timeout_ms: 10000,
    },
  ],
  capture: { at_end: ["dom", "accessibility", "url"] },
};
await writeFile(
  "artifacts/rea/quote-scenario.json",
  JSON.stringify(input, null, 2),
);
console.log(
  "Prepared a declared, read-only-before-submit REA browser scenario for the local reference provider.",
);
