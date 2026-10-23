import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { Store } from "./store.js";
import { ReferenceProvider } from "./provider.js";
import { PortalAdapter } from "./adapter.js";
import { Coordinator, AppError } from "./coordinator.js";
import { DESTINATIONS, localDate } from "./shared.js";
import { JourneyService, JourneyUnavailable } from "./journeys.js";
import {
  LONDON_PLACES,
  DEFAULT_JOURNEY_PREFERENCES,
  type JourneyPreferences,
  type SavedJourney,
} from "./journeys-shared.js";
import { StudyRecorder } from "./study.js";
import { LocalVoice } from "./voice.js";
import {
  mountCloudAccess,
  validateCloudAccess,
  type CloudAccess,
} from "./cloud-access.js";

export async function createApplication(options: {
  dir: string;
  port?: number;
  host?: string;
  journeyFetch?: typeof fetch;
  cloud?: CloudAccess;
}) {
  const cloud = options.cloud ? validateCloudAccess(options.cloud) : undefined;
  if (
    options.host &&
    options.host !== "127.0.0.1" &&
    !(cloud && options.host === "0.0.0.0")
  )
    throw new Error(
      "Handback is a local-only prototype. HANDBACK_HOST must be 127.0.0.1. LAN/public binding is not supported.",
    );
  const store = new Store(options.dir),
    provider = new ReferenceProvider(options.dir),
    adapter = new PortalAdapter("");
  const coordinator = new Coordinator(store, adapter);
  const journeys = new JourneyService(options.journeyFetch),
    study = new StudyRecorder(store);
  const voice = new LocalVoice();
  const journeyPrefs = () =>
    store.get<JourneyPreferences>("journeyPreferences") ||
    DEFAULT_JOURNEY_PREFERENCES;
  const placeId = z.enum(LONDON_PLACES.map((p) => p.id));
  const journeySchema = z
    .object({
      originId: placeId,
      destinationIds: z.array(placeId).min(1).max(3),
      maxWalkingMinutes: z.number().int().min(0).max(60),
      maxChanges: z.number().int().min(0).max(3),
      stepFree: z.boolean(),
    })
    .refine(
      (p) => !p.destinationIds.includes(p.originId),
      "Starting station cannot also be a destination",
    );
  const app = express();
  app.disable("x-powered-by");
  const allowedHosts = new Set(["127.0.0.1", "localhost", "10.0.2.2", "[::1]"]);
  if (cloud) allowedHosts.add(new URL(cloud.publicOrigin).hostname);
  app.use((req, res, next) => {
    if (!allowedHosts.has(req.hostname)) {
      res
        .status(403)
        .json({ error: "This prototype accepts local requests only." });
      return;
    }
    const origin = req.headers.origin;
    if (origin && origin !== "null") {
      try {
        const u = new URL(origin);
        if (
          !allowedHosts.has(u.hostname) ||
          (cloud &&
            origin !== cloud.publicOrigin &&
            !["localhost", "127.0.0.1", "10.0.2.2", "[::1]"].includes(
              u.hostname,
            ))
        ) {
          res.status(403).json({ error: "Unrecognized origin." });
          return;
        }
      } catch {
        res.status(403).end();
        return;
      }
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (cloud) res.setHeader("Cache-Control", "no-store");
    // Preserve the Origin on same-origin form posts so the private login can
    // reject cross-site submissions. No referrer is sent to external sites.
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (req.path.startsWith("/api") || req.path.startsWith("/provider/api"))
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  if (cloud) mountCloudAccess(app, cloud);
  app.use(express.json({ limit: "32kb" }));
  function admin(req: Request, res: Response, next: NextFunction) {
    if (req.headers.authorization !== `Bearer ${store.get("adminToken")}`) {
      res
        .status(401)
        .json({ error: "Open the helper dashboard on this laptop." });
      return;
    }
    next();
  }
  function paired(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (
      !token ||
      !(token === store.get("adminToken") || token === store.get("tvToken"))
    ) {
      res
        .status(401)
        .json({ error: "Please pair this television with your helper." });
      return;
    }
    next();
  }
  function idle(_req: Request, res: Response, next: NextFunction) {
    if (store.tasks().some((t) => t.state === "submitting")) {
      res.status(409).json({
        error:
          "A trip is being submitted and checked. Please wait before changing task permissions or pairing.",
      });
      return;
    }
    next();
  }
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      name: "Handback TV",
      mode: "local-reference-provider",
    }),
  );
  app.get("/api/bootstrap", (req, res) => {
    let previewToken: string | undefined;
    if (cloud && res.locals.cloudOwner) {
      previewToken = store.get<string>("tvToken");
      if (!previewToken) {
        previewToken = randomBytes(32).toString("hex");
        store.set("tvToken", previewToken);
      }
    }
    const isHelper =
      req.query.role === "helper" &&
      (["localhost", "127.0.0.1", "[::1]"].includes(req.hostname) ||
        (cloud && res.locals.cloudOwner));
    res.json({
      destinations: DESTINATIONS,
      dates: Array.from({ length: 7 }, (_, i) => localDate(i + 1)),
      deploymentMode: cloud ? "cloud-preview" : "local",
      ...(previewToken ? { previewToken } : {}),
      ...(isHelper ? { adminToken: store.get("adminToken") } : {}),
    });
  });
  const attempts = new Map<string, { count: number; until: number }>();
  app.post("/api/pair", (req, res) => {
    const key = req.ip || "local";
    const a = attempts.get(key);
    if (a && a.until > Date.now() && a.count >= 8) {
      res
        .status(429)
        .json({ error: "Too many attempts. Please wait a minute." });
      return;
    }
    attempts.set(key, {
      count: (a && a.until > Date.now() ? a.count : 0) + 1,
      until: Date.now() + 60000,
    });
    const code = z
      .object({ code: z.string().regex(/^\d{6}$/) })
      .parse(req.body).code;
    const p = store.get<{ code: string; expiresAt: string; used: boolean }>(
      "pairing",
    )!;
    if (p.code !== code || p.used || Date.parse(p.expiresAt) <= Date.now()) {
      res.status(401).json({
        error:
          "This pairing code is invalid or has expired. Ask your helper for a new code.",
      });
      return;
    }
    const token = randomBytes(32).toString("hex");
    store.set("tvToken", token);
    store.set("pairing", { ...p, used: true });
    attempts.delete(key);
    store.event(
      null,
      "paired",
      "A television was paired with the local service.",
    );
    res.json({ token });
  });
  app.get("/api/state", paired, (_req, res) =>
    res.json({
      capability: store.capability(),
      tasks: store.tasks(),
      providerMode: "reference",
      deploymentMode: cloud ? "cloud-preview" : "local",
      journeyPreferences: journeyPrefs(),
      study: study.active() || null,
    }),
  );
  app.post("/api/voice", paired, async (req, res) => {
    const { text } = z
      .object({ text: z.string().trim().min(1).max(1800) })
      .parse(req.body);
    try {
      res.json(await voice.create(text));
    } catch (e) {
      throw new AppError(
        503,
        e instanceof Error &&
        (e.message.startsWith("Local speech") ||
          e.message.startsWith("Read aloud"))
          ? e.message
          : "Read aloud is unavailable. Your route remains on screen.",
      );
    }
  });
  // Unguessable, loopback-only media capability, expires after two minutes.
  app.get("/api/voice/:id", (req, res) => {
    const id = String(req.params.id);
    const audio = /^[a-f0-9]{32}$/.test(id) ? voice.audio(id) : undefined;
    if (!audio) {
      res.status(404).end();
      return;
    }
    res.type("audio/wav").send(audio);
  });
  app.get("/api/helper", admin, (_req, res) =>
    res.json({
      capability: store.capability(),
      pairing: store.get("pairing"),
      tasks: store.tasks(),
      events: store.events(),
      lab: provider.config(),
      deploymentMode: cloud ? "cloud-preview" : "local",
      journeyPreferences: journeyPrefs(),
      studySessions: study.sessions(),
    }),
  );
  app.put("/api/helper/journeys", admin, (req, res) => {
    const prefs = journeySchema.parse(req.body);
    prefs.destinationIds = [...new Set(prefs.destinationIds)];
    store.set("journeyPreferences", prefs);
    res.json(prefs);
  });
  app.post("/api/journeys/plan", paired, async (req, res) => {
    const { destinationId } = z
      .object({ destinationId: placeId })
      .parse(req.body);
    const prefs = structuredClone(journeyPrefs());
    const plan = await journeys.plan(prefs, destinationId);
    if (JSON.stringify(prefs) !== JSON.stringify(journeyPrefs()))
      throw new AppError(
        409,
        "Your helper updated the journey settings. Please choose your destination again.",
      );
    store.set("latestJourney", plan);
    res.json(plan);
  });
  app.get("/api/journeys/saved", paired, (_req, res) =>
    res.json(store.get<SavedJourney[]>("savedJourneys") || []),
  );
  app.post("/api/journeys/save", paired, (req, res) => {
    const { planId, optionId } = z
      .object({ planId: z.uuid(), optionId: z.string() })
      .parse(req.body);
    const plan =
      store.get<import("./journeys-shared.js").JourneyPlan>("latestJourney");
    if (
      !plan ||
      plan.id !== planId ||
      plan.stale ||
      Date.now() - Date.parse(plan.fetchedAt) > 5 * 60000
    )
      throw new AppError(409, "Please refresh this journey before saving it.");
    if (JSON.stringify(plan.preferences) !== JSON.stringify(journeyPrefs()))
      throw new AppError(
        409,
        "Journey settings changed. Please check this route again.",
      );
    if (!plan.options.some((o) => o.id === optionId))
      throw new AppError(400, "Choose an available route.");
    const saved = store.get<SavedJourney[]>("savedJourneys") || [];
    const existing = saved.find(
      (s) => s.plan.id === planId && s.optionId === optionId,
    );
    if (existing) {
      res.json(existing);
      return;
    }
    const item: SavedJourney = {
      id: randomBytes(16).toString("hex"),
      savedAt: new Date().toISOString(),
      plan,
      optionId,
    };
    store.set("savedJourneys", [item, ...saved].slice(0, 20));
    res.status(201).json(item);
  });
  app.post("/api/helper/study/start", admin, (req, res) => {
    const input = z
      .object({
        kind: z.enum(["human", "self", "automated"]),
        condition: z.enum(["handback", "baseline"]),
        task: z.enum(["live-journey", "reference-booking"]),
        consent: z.literal(true),
      })
      .parse(req.body);
    if (study.active())
      throw new AppError(409, "Finish the current observation first.");
    res.status(201).json(study.start(input));
  });
  app.post("/api/study/:id/event", paired, (req, res) => {
    const { type, count } = z
      .object({
        type: z.enum(["remote", "read-aloud"]),
        count: z.number().int().min(1).max(500).default(1),
      })
      .parse(req.body);
    if (study.active()?.id !== req.params.id)
      throw new AppError(409, "This observation is no longer active.");
    res.json(study.event(String(req.params.id), type, count));
  });
  app.post("/api/helper/study/:id/assistance", admin, (req, res) => {
    if (study.active()?.id !== req.params.id)
      throw new AppError(409, "This observation is no longer active.");
    res.json(study.event(String(req.params.id), "assistance"));
  });
  app.post("/api/helper/study/:id/finish", admin, (req, res) => {
    const { outcome } = z
      .object({ outcome: z.enum(["independent", "assisted", "incomplete"]) })
      .parse(req.body);
    if (study.active()?.id !== req.params.id)
      throw new AppError(409, "This observation is no longer active.");
    res.json(study.finish(String(req.params.id), outcome));
  });
  app.delete("/api/helper/study", admin, (_req, res) => {
    study.clear();
    res.json({ ok: true });
  });
  app.get("/api/helper/study/export", admin, (_req, res) =>
    res.json({
      exportedAt: new Date().toISOString(),
      sessions: study.sessions(),
      caveat:
        "Observer-reported outcomes. Remote presses count only inside Handback. Human, self, and automated sessions are distinct; no population-level claim is supported.",
    }),
  );
  app.post("/api/helper/pairing", admin, (_req, res) =>
    res.json(store.renewPairing()),
  );
  app.post("/api/helper/revoke", admin, idle, (_req, res) => {
    store.set("tvToken", null);
    res.json({ ok: true });
  });
  const capSchema = z.object({
    passenger: z.string().trim().min(1).max(40),
    pickup: z.string().trim().min(3).max(100),
    allowedDestinations: z
      .array(z.enum(["library", "garden", "arts"]))
      .min(1)
      .max(3),
    maxFare: z.number().int().min(0).max(1000),
    expiresAt: z.iso.datetime(),
    title: z.string().trim().min(1).max(70),
  });
  app.put("/api/helper/capability", admin, idle, (req, res) => {
    const input = capSchema.parse(req.body);
    const cap = {
      ...input,
      allowedDestinations: [...new Set(input.allowedDestinations)],
      revision: store.capability().revision + 1,
    };
    store.set("capability", cap);
    store.event(
      null,
      "settings_updated",
      `Helper reviewed task settings, revision ${cap.revision}.`,
    );
    res.json(cap);
  });
  app.post("/api/tasks", paired, async (req, res) => {
    const input = z
      .object({
        destinationId: z.enum(["library", "garden", "arts"]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(req.body);
    res
      .status(201)
      .json(await coordinator.preview(input.destinationId, input.date));
  });
  app.post("/api/tasks/:id/confirm", paired, async (req, res) => {
    const input = z
      .object({ confirmationToken: z.string().min(1) })
      .parse(req.body);
    res.json(
      await coordinator.confirm(String(req.params.id), input.confirmationToken),
    );
  });
  app.post("/api/tasks/:id/check", paired, async (req, res) =>
    res.json(await coordinator.check(String(req.params.id))),
  );
  app.post("/api/tasks/:id/cancel", paired, (req, res) =>
    res.json(coordinator.cancel(String(req.params.id))),
  );
  app.post("/api/lab", admin, (req, res) => {
    const patch = z
      .object({
        fareDelta: z.number().int().min(0).max(500).optional(),
        layout: z.enum(["classic", "modern", "unsupported"]).optional(),
        loseNextResponse: z.boolean().optional(),
        hideHistory: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    res.json(provider.update(patch));
  });
  app.post("/api/lab/reset", admin, (_req, res) => {
    if (store.tasks().some((t) => t.state === "submitting"))
      throw new AppError(
        409,
        "Wait for the current task to finish before resetting the test scenario.",
      );
    provider.reset();
    store.resetTasks();
    store.event(
      null,
      "lab_reset",
      "The local fictional reference scenario was reset.",
    );
    res.json({ ok: true });
  });
  app.get("/provider/api/config", (_req, res) =>
    res.json({
      destinations: DESTINATIONS,
      config: provider.config(),
      tomorrow: localDate(1),
    }),
  );
  const quoteSchema = z.object({
    passenger: z.string().min(1).max(40),
    pickup: z.string().min(3).max(100),
    destinationId: z.string(),
    date: z.string(),
  });
  app.post("/provider/api/quote", (req, res) => {
    res.json(provider.quote(quoteSchema.parse(req.body)));
  });
  app.post("/provider/api/book", (req, res) => {
    const input = z
      .object({
        terms: quoteSchema.extend({
          destination: z.string(),
          time: z.string(),
          fare: z.number(),
          currency: z.literal("INR"),
          version: z.number(),
        }),
        signature: z.string(),
        requestId: z.uuid(),
      })
      .parse(req.body);
    const result = provider.book(input);
    if ("changed" in result) {
      res.status(409).json({ changed: true });
      return;
    }
    if (result.lost) {
      res.status(503).json({
        error: "Injected test: response lost after the reservation was stored.",
      });
      return;
    }
    res.json(result.receipt);
  });
  app.get("/provider/api/history", (_req, res) => {
    if (provider.config().hideHistory) {
      res
        .status(503)
        .json({ error: "Injected test: booking history unavailable." });
      return;
    }
    res.json(provider.list());
  });
  app.use(
    express.static(resolve("dist"), {
      etag: false,
      lastModified: false,
      setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
    }),
  );
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(resolve("dist/index.html"));
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: "Please check the supplied fields.",
        details: err.issues.map((x) => ({
          field: x.path.join("."),
          message: x.message,
        })),
      });
      return;
    }
    if (err instanceof JourneyUnavailable) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err instanceof Error ? err.message : err);
    res.status(500).json({
      error:
        "The local service could not complete this step. Please try again or check your unfinished trip.",
    });
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((r) => {
    const s = app.listen(
      options.port ?? 4310,
      options.host ?? "127.0.0.1",
      () => r(s),
    );
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  const url = `http://127.0.0.1:${address.port}`;
  adapter.baseUrl = url;
  return {
    app,
    server,
    url,
    store,
    provider,
    coordinator,
    adapter,
    close: async () => {
      await adapter.close();
      await new Promise<void>((r) => server.close(() => r()));
      store.close();
      provider.close();
    },
  };
}
