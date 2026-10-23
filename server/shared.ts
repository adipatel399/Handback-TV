export type Destination = {
  id: string;
  name: string;
  note: string;
  time: string;
  fare: number;
  color: string;
};
export const DESTINATIONS: Destination[] = [
  {
    id: "library",
    name: "Riverside Library",
    note: "A little time for a good book",
    time: "09:30",
    fare: 80,
    color: "#d6e9cf",
  },
  {
    id: "garden",
    name: "Community Garden",
    note: "Fresh air. Familiar faces.",
    time: "10:15",
    fare: 60,
    color: "#f4dfb4",
  },
  {
    id: "arts",
    name: "The Arts Centre",
    note: "Make something of your morning",
    time: "11:00",
    fare: 100,
    color: "#dddbef",
  },
];
export const ZONE = "Asia/Kolkata";
export function localDate(offset = 0): string {
  const d = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const x = new Date(`${today}T12:00:00+05:30`);
  x.setUTCDate(x.getUTCDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
}
export type Terms = {
  passenger: string;
  destinationId: string;
  destination: string;
  date: string;
  time: string;
  pickup: string;
  fare: number;
  currency: "INR";
  version: number;
};
// JSON object property order is not part of a trip's meaning.
export const canonicalTerms = (t: Terms) =>
  JSON.stringify([
    t.passenger,
    t.pickup,
    t.destinationId,
    t.destination,
    t.date,
    t.time,
    t.fare,
    t.currency,
    t.version,
  ]);
export type Capability = {
  passenger: string;
  pickup: string;
  allowedDestinations: string[];
  maxFare: number;
  expiresAt: string;
  revision: number;
  title: string;
};
export type Receipt = Terms & {
  reference: string;
  requestId: string;
  createdAt: string;
  verifiedAt?: string;
};
export type TaskState =
  | "awaiting_confirmation"
  | "submitting"
  | "verified"
  | "unknown"
  | "failed"
  | "cancelled";
export type Task = {
  id: string;
  state: TaskState;
  terms: Terms;
  capabilityRevision: number;
  confirmationToken: string;
  expiresAt: string;
  receipt?: Receipt;
  message: string;
  createdAt: string;
  updatedAt: string;
};
export const money = (value: number) => `₹${value}`;
