import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { join } from "node:path";
import {
  DESTINATIONS,
  localDate,
  canonicalTerms,
  type Receipt,
  type Terms,
} from "./shared.js";

// Independent reference service. The Handback coordinator accesses it through browser UI only.
export class ReferenceProvider {
  db: DatabaseSync;
  constructor(dir: string) {
    this.db = new DatabaseSync(join(dir, "reference-provider.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bookings(request_id TEXT PRIMARY KEY,body TEXT NOT NULL);`);
    if (!this.get("secret"))
      this.set("secret", randomBytes(32).toString("hex"));
    if (!this.get("config")) this.reset();
  }
  get<T>(k: string): T | undefined {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get(k) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }
  set(k: string, v: unknown) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(k, JSON.stringify(v));
  }
  config() {
    return this.get<{
      version: number;
      fareDelta: number;
      layout: "classic" | "modern" | "unsupported";
      loseNextResponse: boolean;
      hideHistory: boolean;
    }>("config")!;
  }
  reset() {
    this.set("config", {
      version: 1,
      fareDelta: 0,
      layout: "classic",
      loseNextResponse: false,
      hideHistory: false,
    });
    this.db.exec("DELETE FROM bookings;");
  }
  update(patch: Partial<ReturnType<ReferenceProvider["config"]>>) {
    const c = this.config();
    const next = { ...c, ...patch };
    if (patch.fareDelta !== undefined && patch.fareDelta !== c.fareDelta)
      next.version++;
    this.set("config", next);
    return next;
  }
  quote(input: {
    passenger: string;
    pickup: string;
    destinationId: string;
    date: string;
  }) {
    const d = DESTINATIONS.find((x) => x.id === input.destinationId);
    if (!d) throw new Error("Unknown destination");
    if (
      input.date < localDate(1) ||
      input.date > localDate(14) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      Number.isNaN(Date.parse(input.date))
    )
      throw new Error("Choose a date within the next 14 days");
    const c = this.config();
    const terms: Terms = {
      passenger: input.passenger,
      pickup: input.pickup,
      destinationId: d.id,
      destination: d.name,
      date: input.date,
      time: d.time,
      fare: d.fare + c.fareDelta,
      currency: "INR",
      version: c.version,
    };
    const signature = createHmac("sha256", this.get<string>("secret")!)
      .update(canonicalTerms(terms))
      .digest("hex");
    return { terms, signature };
  }
  book(input: { terms: Terms; signature: string; requestId: string }) {
    const old = this.find(input.requestId);
    if (old) return { receipt: old, lost: false };
    const now = this.quote(input.terms);
    const a = Buffer.from(now.signature);
    const b = Buffer.from(input.signature);
    if (
      a.length !== b.length ||
      !timingSafeEqual(a, b) ||
      canonicalTerms(now.terms) !== canonicalTerms(input.terms)
    )
      return { changed: true as const };
    const receipt: Receipt = {
      ...now.terms,
      requestId: input.requestId,
      reference: `WL-${randomUUID().slice(0, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare("INSERT INTO bookings VALUES(?,?)")
      .run(input.requestId, JSON.stringify(receipt));
    const c = this.config();
    this.update({ loseNextResponse: false });
    return { receipt, lost: c.loseNextResponse };
  }
  find(id: string): Receipt | undefined {
    const row = this.db
      .prepare("SELECT body FROM bookings WHERE request_id=?")
      .get(id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : undefined;
  }
  list(): Receipt[] {
    return (
      this.db
        .prepare("SELECT body FROM bookings ORDER BY rowid DESC")
        .all() as { body: string }[]
    ).map((x) => JSON.parse(x.body));
  }
  close() {
    this.db.close();
  }
}
