import { randomUUID } from "node:crypto";
import type { Store } from "./store.js";
export type StudySession = {
  id: string;
  kind: "human" | "self" | "automated";
  condition: "handback" | "baseline";
  task: "live-journey" | "reference-booking";
  startedAt: string;
  endedAt?: string;
  outcome?: "independent" | "assisted" | "incomplete";
  remotePresses: number;
  readAlouds: number;
  assistance: number;
  durationSeconds?: number;
};
export class StudyRecorder {
  constructor(private store: Store) {}
  sessions(): StudySession[] {
    return this.store.get<StudySession[]>("studySessions") || [];
  }
  active() {
    return this.sessions().find((s) => !s.endedAt);
  }
  private save(sessions: StudySession[]) {
    this.store.set("studySessions", sessions.slice(-100));
  }
  start(input: Pick<StudySession, "kind" | "condition" | "task">) {
    if (this.active()) throw new Error("Finish the active observation first.");
    const session: StudySession = {
      ...input,
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      remotePresses: 0,
      readAlouds: 0,
      assistance: 0,
    };
    this.save([...this.sessions(), session]);
    return session;
  }
  event(id: string, type: "remote" | "read-aloud" | "assistance", count = 1) {
    const sessions = this.sessions(),
      s = sessions.find((x) => x.id === id && !x.endedAt);
    if (!s) throw new Error("This observation has ended or is unavailable.");
    if (type === "remote" && s.condition === "handback")
      s.remotePresses = Math.min(10000, s.remotePresses + count);
    if (type === "read-aloud") s.readAlouds += count;
    if (type === "assistance") s.assistance += count;
    this.save(sessions);
    return s;
  }
  finish(id: string, outcome: NonNullable<StudySession["outcome"]>) {
    const sessions = this.sessions(),
      s = sessions.find((x) => x.id === id && !x.endedAt);
    if (!s) throw new Error("This observation has ended or is unavailable.");
    s.endedAt = new Date().toISOString();
    s.durationSeconds = Math.round(
      (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000,
    );
    s.outcome =
      outcome === "independent" && s.assistance > 0 ? "assisted" : outcome;
    this.save(sessions);
    return s;
  }
  clear() {
    this.store.set("studySessions", []);
  }
}
