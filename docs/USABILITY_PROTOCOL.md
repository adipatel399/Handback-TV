# An honest 15-minute observation

Current evidence: the builder can self-test; no older-adult participant is available. Do not describe builder runs or automated runs as customer validation.

## Preparation

Run the laptop service and Android TV emulator, or sign in to the private Azure preview with the cloud APK. Open **Helper → Live journeys**. Use King’s Cross as the origin, Green Park as a destination, 30 minutes maximum walking, one maximum transport change, and step-free routing requested. These are public London stations for a hypothetical planning task; the builder does not need to be in London. No real trip, ticket, or reservation is required.

Open **Usability sessions**. Select **Builder self-test**, **Handback TV**, and **Find and review a real journey**. Read the consent statement and start when ready. The session stores an anonymous random ID, condition, elapsed time, remote inputs in Handback, read-aloud requests, assistance, and an observer-reported result. It collects no names, voice recording, or video. Data stays in the active laptop or Azure database until deleted. The private hosted preview shares data among invited reviewers. Exports may be shared only deliberately.

## Assigned task

“Find a route from King’s Cross to Green Park. Tell me the total walking time and the transport direction. Review each step, save the route, and find the saved copy again.”

Use only the emulator D-pad and Select after setup. Try Play/Pause to read the current screen aloud, then stop it. Do not provide hints while claiming independent completion. Record each instance of help. If a real participant becomes uncomfortable, stop; an incomplete result is useful evidence.

The facilitator marks **Completed independently**, **Completed with help**, or **Stopped / incomplete**. The system changes an independent label to assisted if assistance was recorded. A saved route is not by itself proof of independent understanding.

## Optional baseline

Repeat the same hypothetical origin, destination, access preference, and walking/change limits using the original TfL journey planner at <https://tfl.gov.uk/plan-a-journey/>. Select **Original service / baseline** before starting the timer. Baseline input counts are not captured. For multiple participants, alternate which interface they try first. For one builder run, report the order and familiarity as confounds.

The two device/interface conditions and practice effects prevent a clean causal conclusion. Record descriptive observations; do not claim a statistically demonstrated improvement from this tiny sample. Check that the baseline plan actually meets the same constraints rather than comparing different journeys.

## Five questions after the task

1. Where will you start, and where will you arrive?
2. How much walking is involved? Is that comfortable for you?
3. Which direction will the train or bus travel?
4. Has a ticket been purchased? (Correct: no.)
5. Would you feel able to repeat the planning task without help? What was confusing?

Write only consented, non-identifying observations in `docs/USER_FINDINGS.md`. No invented quotations. Keep self-test findings separate from target-user findings.

## Afterward

Export from the dashboard for your review. The elapsed time is start-to-finish wall time, including API latency and time spent reading; it is not pure interaction time. Remote counts include Handback inputs only and are not comparable with missing baseline counts. Inspect failed attempts and assistance alongside completion. The app never generates a customer-impact percentage automatically.
