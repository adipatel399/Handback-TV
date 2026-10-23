// Synthetic provider response for deterministic verification; not live transport data.
export const sampleTfL = {
  journeys: [
    {
      duration: 22,
      startDateTime: "2026-10-23T09:30:00",
      arrivalDateTime: "2026-10-23T09:52:00",
      legs: [
        {
          duration: 5,
          instruction: {
            summary: "Walk to King’s Cross",
            detailed: "Walk to the station entrance",
          },
          mode: { id: "walking" },
          departureTime: "2026-10-23T09:30:00",
          arrivalTime: "2026-10-23T09:35:00",
          departurePoint: { commonName: "Station entrance" },
          arrivalPoint: { commonName: "King’s Cross" },
          disruptions: [],
        },
        {
          duration: 12,
          instruction: {
            summary: "Victoria line to Green Park",
            detailed: "Victoria line towards Brixton",
          },
          mode: { id: "tube" },
          departureTime: "2026-10-23T09:35:00",
          arrivalTime: "2026-10-23T09:47:00",
          departurePoint: { commonName: "King’s Cross" },
          arrivalPoint: { commonName: "Green Park" },
          disruptions: [],
        },
        {
          duration: 5,
          instruction: { summary: "Walk to Green Park exit" },
          mode: { id: "walking" },
          departureTime: "2026-10-23T09:47:00",
          arrivalTime: "2026-10-23T09:52:00",
          departurePoint: { commonName: "Green Park platform" },
          arrivalPoint: { commonName: "Green Park exit" },
          disruptions: [],
        },
      ],
    },
  ],
};
