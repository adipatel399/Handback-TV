import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { DESTINATIONS, type Capability, type Task } from "./shared.js";

export class Store {
  db: DatabaseSync;
  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(join(dir, "handback.sqlite"));
    this.db
      .exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,state TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT,kind TEXT NOT NULL,detail TEXT NOT NULL,at TEXT NOT NULL);`);
    if (!this.get("adminToken"))
      this.set("adminToken", randomBytes(32).toString("hex"));
    if (!this.get("pairing")) this.renewPairing();
    if (!this.get("capability"))
      this.set("capability", {
        passenger: "Arun",
        pickup: "12 Willow Lane",
        allowedDestinations: DESTINATIONS.map((d) => d.id),
        maxFare: 150,
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        revision: 1,
        title: "A little more independence",
      } satisfies Capability);
    // A process may have stopped after the provider accepted a booking. Never blindly replay that write.
    for (const task of this.tasks())
      if (task.state === "submitting") {
        task.state = "unknown";
        task.message =
          "We restarted while checking your booking. Please check the result before trying again.";
        this.saveTask(task);
      }
  }
  get<T>(key: string): T | undefined {
    const row = this.db.prepare("SELECT value FROM kv WHERE key=?").get(key) as
      | { value: string }
      | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO kv VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  capability() {
    return this.get<Capability>("capability")!;
  }
  renewPairing() {
    const p = {
      code: String(Math.floor(100000 + Math.random() * 900000)),
      expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
      used: false,
    };
    this.set("pairing", p);
    return p;
  }
  tasks(): Task[] {
    return (
      this.db.prepare("SELECT body FROM tasks ORDER BY rowid DESC").all() as {
        body: string;
      }[]
    ).map((x) => JSON.parse(x.body));
  }
  task(id: string): Task | undefined {
    const x = this.db.prepare("SELECT body FROM tasks WHERE id=?").get(id) as
      | { body: string }
      | undefined;
    return x ? JSON.parse(x.body) : undefined;
  }
  saveTask(task: Task) {
    task.updatedAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO tasks VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,body=excluded.body",
      )
      .run(task.id, task.state, JSON.stringify(task));
  }
  claim(id: string) {
    return (
      this.db
        .prepare(
          "UPDATE tasks SET state='submitting' WHERE id=? AND state='awaiting_confirmation'",
        )
        .run(id).changes === 1
    );
  }
  event(taskId: string | null, kind: string, detail: string) {
    this.db
      .prepare("INSERT INTO events(task_id,kind,detail,at) VALUES(?,?,?,?)")
      .run(taskId, kind, detail, new Date().toISOString());
  }
  events() {
    return this.db
      .prepare(
        "SELECT task_id AS taskId,kind,detail,at FROM events ORDER BY id DESC LIMIT 60",
      )
      .all();
  }
  resetTasks() {
    this.db.exec("DELETE FROM tasks; DELETE FROM events;");
  }
  close() {
    this.db.close();
  }
}
