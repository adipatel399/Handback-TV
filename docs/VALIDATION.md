# Validation of the upgraded prototype

Updated 23 October 2026. Development verification is separate from user evidence.

## Reproducible checks

- `npm run typecheck` checks the TypeScript application and verification scripts.
- `npm test` runs the workflow and journey suites. `artifacts/test-results.tap` is authoritative for the final count and status. Tests include real Chromium booking actions, quote changes, spending/permission limits, concurrent submissions, missing responses, read-back recovery, unsupported layouts, restart recovery, live-integration schema/constraints/cache/failure behavior, rate bounds, in-flight helper changes, observation consent, assisted outcome classification, actual local WAV generation on macOS, and private cloud access/session restrictions.
- `npm run test:ui` verifies the reference booking interface, persistence, helper changes, changed fares, disconnect recovery, and 960×540 fit.
- `npm run test:journey-ui` verifies the real-integration UI with explicitly synthetic deterministic transport responses. It checks pairing, all remote steps, local save, constraint rejection, observation recording, and exclusion of automated observations from participant results. This test does not establish live API availability.

## Actual external integration

`npm run test:live` requests the real TfL Unified API for each configured destination. `artifacts/live-tfl-verification.json` records actual URLs, timestamps, latency, and returned options. A zero-option result is valid when no response route fits the limits. No mock or fabricated route is substituted for a failure.

## Actual Android TV emulator

The installed APK is `com.handback.tv` on Android TV API 33 ARM64.

- `artifacts/emulator-verification.json`: actual native pairing dialog and full reference booking using Android D-pad events, with a matching stored receipt.
- `artifacts/live-emulator-verification.json`: real TfL response, actual Media Play/Pause, native audio playback and stop events, D-pad route review, every instruction, local saved route, and logical viewport fit. The report identifies whether an offline Android voice was available and the local speech fallback.

These are emulator checks, not physical Fire OS/Vega checks. Audio playback events establish that the native player started/stopped; they do not constitute a hearing or accessibility study.

## Actual Azure preview

`artifacts/azure-verification.json` records actual publicly trusted HTTPS, password login, anonymous bootstrap/history denial, secure session cookies, automatic TV access, Linux eSpeak NG WAV output, real TfL routing, persisted route saving, and Chromium-driven reference booking with a stored receipt. `artifacts/azure-emulator-verification.json` records the separate cloud APK's native Android D-pad and protected speech playback. These use the deployed service, not a simulated cloud response. See `docs/AZURE_DEPLOYMENT.md` for the exact configuration and credential boundary.

## REA

Retained REA evidence concerns the fictional provider's quote workflow only. See `docs/REA_FINDINGS.md`. It does not establish the real TfL integration or a real booking.

## Media

The current local demo and probe are `artifacts/handback-tv-demo-review.mp4` and `artifacts/demo-media-verification.json`. Sources, synthetic narration, explicit scenario transition, and limits are documented in `docs/DEMO_RECORDING.md`. No video has been published.

## User evidence

Target-user participants: **zero**. The builder confirmed only a self-test is available. The observation dashboard and `docs/USABILITY_PROTOCOL.md` support that task; no completed self-test is claimed until the builder records it. Automated checks are always labelled automated. No improvement percentage, testimonial, or accessibility certification is inferred.

## Remaining boundaries

London public-station pilot; laptop required in local mode or Student-credit VM availability in hosted mode; no live ticketing, fares, or bookings; step-free routing is not an accessibility guarantee; private shared-household authentication; single VM with no off-VM backup; no physical Fire TV or target-user validation. Azure deployment is authorized and active. Git commits, repository/video publication, and final submission await the builder's approval.
