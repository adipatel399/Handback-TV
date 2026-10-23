import { resolve } from "node:path";
import { createApplication } from "./app.js";
const instance = await createApplication({
  dir: resolve(process.env.HANDBACK_DATA_DIR || ".data"),
  port: Number(process.env.HANDBACK_PORT || 4310),
  host: process.env.HANDBACK_HOST || "127.0.0.1",
  ...(process.env.HANDBACK_PUBLIC_ORIGIN
    ? {
        cloud: {
          publicOrigin: process.env.HANDBACK_PUBLIC_ORIGIN,
          password: process.env.HANDBACK_PREVIEW_PASSWORD || "",
        },
      }
    : {}),
});
console.log(
  `\nHandback TV is ready.\nHelper: ${instance.url}/helper\nTV:     ${instance.url}/tv\nPortal: ${instance.url}/provider\n\nLocal reference service · fictional bookings · no external charges\n`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await instance.close();
    process.exit(0);
  });
