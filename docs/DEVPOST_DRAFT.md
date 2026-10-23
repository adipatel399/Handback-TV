# Handback TV

## Elevator pitch

A helper sets the boundaries. You choose the journey. Handback turns real London travel planning into familiar remote choices, spoken guidance, and one clear step at a time.

## Inspiration

Knowing where you want to go and navigating a travel website are different abilities. We explore whether a familiar television remote can let someone retain the decision while a trusted helper handles initial setup.

The audience hypothesis is an older adult comfortable with a TV remote who finds web forms demanding. No older-adult study has been completed. The builder can self-test; the app deliberately distinguishes self-tests, automated checks, and participant observations.

## What it does

A helper chooses public London stations, a starting point, maximum total walking, maximum transport changes, and a step-free routing preference. The TV presents familiar destinations. It requests actual journey options from the TfL Unified API and filters them against the helper's limits without silently relaxing them.

The person reviews duration, walking, direction, and London-local times, then opens one instruction at a time. Play/Pause reads the current screen aloud; pressing it again stops. A reviewed route can be saved locally and checked afresh later. No ticket is purchased and no live transport reservation is made. Cached or unavailable data is explicitly identified.

A separate, labelled booking lab demonstrates the more demanding write boundary: exact-term confirmation, changed-fare reconfirmation, stored-receipt verification, and recovery from an uncertain result. Its Willow Link shuttle provider is fictional. The real TfL planning path and the reference booking path are never presented as the same integration.

## How we built it

The actual Android TV application combines a native Java launcher, explicit D-pad and media-key handling, Android speech/MediaPlayer, connection recovery, and a React/TypeScript WebView interface sized for the emulator's 960×540 logical viewport.

The local Node.js service handles pairing, SQLite persistence, helper preferences, bounded API requests, request coalescing, caching, timeout/failure recovery, schema validation, local route saving, and opt-in observation sessions. TfL receives only allowlisted public station IDs and routing preferences; it receives no passenger name, home address, or Handback token.

Read-aloud first attempts an installed offline Android voice. The emulator's unusable voice exposed the need for a fallback: local macOS speech synthesis streamed to native Android playback. There is no paid speech or AI service. The local fallback uses macOS; the private Azure preview uses Linux eSpeak NG with authenticated native audio playback.

The separate Playwright booking adapter operates the reference provider's rendered interface and reads back stored reservations. REA 6.7.0 captured that bounded quote workflow, with canonical evidence retained. REA did not autonomously generate adapters, and arbitrary website learning is not claimed.

## Challenges

Live integration behaved differently from fixtures. Some TfL station pairs responded slowly or returned no route within our limits. We bounded requests, restricted the pilot to relevant transport modes, made failures visible, and kept the limits rather than inventing a more convenient answer.

A 1080p emulator exposes a 960×540 logical viewport. Actual device verification caught route-list overflow that a one-option fixture missed. Native media input also needed to cooperate with focus and Android audio lifecycle handling.

A successful submit did not establish a successful reservation in the booking lab. Exact semantic matching, durable checkpoints, and read-back verification were essential to retaining uncertainty honestly.

## Accomplishments

A genuine public-data integration, installable TV app, helper-defined limits, remote and spoken guidance, saved routes, explicit service boundaries, and a local usability observation tool. The project includes deterministic tests, real-network smoke checks, browser verification, and native emulator reports. See `docs/VALIDATION.md` for exact current results rather than treating this description as a test report.

## What we learned

The helper should configure the task without taking over the final decision. Source freshness, honest limits, understandable outcomes, and recovery matter as much as the happy path. A builder self-test is useful engineering evidence but cannot validate the experience for older adults.

## What's next

Run the prepared observation protocol with older adults and helpers; revise the interaction from those observations; validate physical Fire TV behavior; and extend the private Azure preview into per-person household accounts with backups and a sustainable hosting plan. A real booking integration requires an authorized partner and explicit transaction semantics.

## Limitations

London public-station pilot; laptop service or Azure credit-backed VM required; no live booking or ticketing; no fare verification; step-free routing does not guarantee lift availability; point-in-time journey data; shared household preview access; macOS/Linux speech fallback; no target-user or physical Fire TV validation.

## Built with

Android, Java, WebView, TextToSpeech, MediaPlayer, React, TypeScript, Node.js, Express, SQLite, TfL Unified API, Playwright, Vite, REA, Android TV Emulator, Gradle, macOS speech synthesis, eSpeak NG, Azure Virtual Machines, Docker Compose, Caddy HTTPS.

## Entry configuration

Primary track: Fire TV. Android TV emulator is accepted by the organizers' FAQ. No AWS Builder mini-challenge claim. Publishing this project's own source alone does not establish an eligible Open Source mini-challenge contribution.

The private Azure preview is deployed with the builder's authorization. GitHub publication, video upload, and final submission have not been performed. Use the real preview URL with privately supplied reviewer credentials; approve the source and media before publishing them.
