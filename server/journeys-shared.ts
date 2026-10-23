export const LONDON_PLACES = [
  {
    id: "kings-cross",
    name: "King’s Cross",
    point: "1000129",
    note: "Your starting station",
  },
  {
    id: "waterloo",
    name: "Waterloo",
    point: "1000265",
    note: "South Bank connections",
  },
  {
    id: "victoria",
    name: "Victoria",
    point: "1000248",
    note: "A familiar interchange",
  },
  {
    id: "green-park",
    name: "Green Park",
    point: "1000093",
    note: "A little fresh air",
  },
  {
    id: "westminster",
    name: "Westminster",
    point: "1000266",
    note: "A walk by the river",
  },
  {
    id: "london-bridge",
    name: "London Bridge",
    point: "1000140",
    note: "The riverside and market",
  },
] as const;
export type LondonPlaceId = (typeof LONDON_PLACES)[number]["id"];
export type JourneyPreferences = {
  originId: LondonPlaceId;
  destinationIds: LondonPlaceId[];
  maxWalkingMinutes: number;
  maxChanges: number;
  stepFree: boolean;
};
export const DEFAULT_JOURNEY_PREFERENCES: JourneyPreferences = {
  originId: "kings-cross",
  destinationIds: ["green-park", "westminster", "london-bridge"],
  maxWalkingMinutes: 30,
  maxChanges: 1,
  stepFree: true,
};
export type JourneyLeg = {
  instruction: string;
  detail: string;
  mode: string;
  duration: number;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  disruptions: string[];
};
export type JourneyOption = {
  id: string;
  duration: number;
  walkingMinutes: number;
  changes: number;
  departure: string;
  arrival: string;
  legs: JourneyLeg[];
  warnings: string[];
};
export type JourneyPlan = {
  id: string;
  source: "tfl";
  origin: string;
  destination: string;
  destinationId: LondonPlaceId;
  fetchedAt: string;
  stale: boolean;
  staleReason?: string;
  timeZone: "Europe/London";
  preferences: JourneyPreferences;
  options: JourneyOption[];
  excludedOptions: number;
  sourceUrl: string;
};
export type SavedJourney = {
  id: string;
  savedAt: string;
  plan: JourneyPlan;
  optionId: string;
};
export const TFL_ATTRIBUTION =
  "Powered by TfL Open Data. Contains OS data © Crown copyright and database rights 2016. Geomni UK Map data © and database rights 2019.";
export function londonClock(value: string) {
  // Journey API wall-clock strings have no offset; never reinterpret them in the laptop's zone.
  const m = value.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "Time unavailable";
}
