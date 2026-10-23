import express, { type Express, type Request } from "express";
import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export type CloudAccess = { publicOrigin: string; password: string };
export function validateCloudAccess(input: CloudAccess): CloudAccess {
  const u = new URL(input.publicOrigin);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    !u.hostname.includes(".")
  )
    throw new Error(
      "Cloud origin must be an HTTPS origin without a path, credentials, or port.",
    );
  if (input.password.length < 24 || input.password.length > 200)
    throw new Error(
      "Cloud preview password must contain at least 24 characters.",
    );
  return { publicOrigin: u.origin, password: input.password };
}
export function internalRequest(req: Request) {
  const address = req.socket.remoteAddress || "";
  return (
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address) &&
    ["127.0.0.1", "localhost", "[::1]"].includes(req.hostname)
  );
}
const equal = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
const safeNext = (value: unknown) =>
  typeof value === "string" &&
  ["/", "/helper", "/tv", "/tv/journeys"].includes(value)
    ? value
    : "/tv/journeys";
export function mountCloudAccess(app: Express, config: CloudAccess) {
  const sign = (value: string) =>
    createHmac("sha256", config.password).update(value).digest("hex");
  const failed = new Map<string, { until: number; count: number }>();
  const validCookie = (req: Request) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("handback_owner="))
      ?.slice(15);
    if (!cookie) return false;
    const [expires, nonce, signature, extra] = cookie.split(".");
    return (
      !extra &&
      /^\d{13}$/.test(expires || "") &&
      /^[a-f0-9]{32}$/.test(nonce || "") &&
      !!signature &&
      Number(expires) > Date.now() &&
      Number(expires) <= Date.now() + 8 * 3600000 + 1000 &&
      equal(sign(`${expires}.${nonce}`), signature)
    );
  };
  const form = (next: string, error = "") =>
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Handback TV · Private preview</title><style>body{margin:0;background:#123439;color:#f3efdb;font:18px Arial,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:540px;padding:38px}h1{font:46px Georgia,serif}p{line-height:1.6;color:#c4d1bc}form{display:grid;gap:16px;margin-top:28px}input,button{font:inherit;padding:15px;border-radius:8px;border:1px solid #a9bea8}button{background:#efbd81;color:#203e3c;cursor:pointer}small{display:block;margin-top:25px;color:#b7c9b0}.error{color:#ffcf9b}</style><main><strong>handback TV</strong><h1>A private space.</h1><p>This hosted preview is for the builder and invited reviewers. Enter the preview password to continue.</p>${error ? `<p class="error" role="alert">${error}</p>` : ""}<form action="/auth/login" method="post"><input type="hidden" name="next" value="${next}"><label for="password">Preview password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200"><button type="submit">Open Handback</button></form><small>Real London journey planning · separate fictional booking lab · no ticket sales</small></main></html>`;
  app.get("/auth/login", (req, res) =>
    res.type("html").send(form(safeNext(req.query.next))),
  );
  app.post(
    "/auth/login",
    express.urlencoded({ extended: false, limit: "2kb" }),
    (req, res) => {
      if (req.headers.origin !== config.publicOrigin) {
        res
          .status(403)
          .send("Open the login page at the preview's HTTPS address.");
        return;
      }
      const key = req.socket.remoteAddress || "local",
        previous = failed.get(key);
      if (previous && previous.until > Date.now() && previous.count >= 10) {
        res
          .status(429)
          .type("html")
          .send(
            form(
              safeNext(req.body?.next),
              "Too many attempts. Please wait a minute.",
            ),
          );
        return;
      }
      if (
        typeof req.body?.password !== "string" ||
        !equal(req.body.password, config.password)
      ) {
        failed.set(key, {
          until: Date.now() + 60000,
          count:
            previous && previous.until > Date.now() ? previous.count + 1 : 1,
        });
        res
          .status(401)
          .type("html")
          .send(form(safeNext(req.body?.next), "That password did not match."));
        return;
      }
      failed.delete(key);
      const value = `${Date.now() + 8 * 3600000}.${randomBytes(16).toString("hex")}`;
      res.setHeader(
        "Set-Cookie",
        `handback_owner=${value}.${sign(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
      );
      res.redirect(303, safeNext(req.body?.next));
    },
  );
  app.use((req, res, next) => {
    if (internalRequest(req) || validCookie(req)) {
      res.locals.cloudOwner = true;
      next();
      return;
    }
    if (req.path.startsWith("/api/") || req.path.startsWith("/provider/api/")) {
      res.status(401).json({
        error: "Open this preview in your browser and sign in first.",
        loginRequired: true,
      });
      return;
    }
    res.redirect(
      303,
      "/auth/login?next=" + encodeURIComponent(safeNext(req.path)),
    );
  });
}
