# Review Handback TV

The upgraded prototype includes a real TfL journey integration, native read-aloud, a separate reference booking lab, and an observation tool. This package is for the builder's review before any commit, publication, or final hackathon submission.

## Start here

1. Watch `artifacts/handback-tv-judges-demo.mp4` (approximately 2 minutes 13 seconds). The narration is synthetic; all application footage comes from this build.
2. Try the private Azure preview at <https://handback-tv-cb7fb9.koreacentral.cloudapp.azure.com/tv/journeys> with the password in the builder’s ignored `.tools/azure/ACCESS.md`. It runs without the laptop. Alternatively, open the running helper dashboard at <http://127.0.0.1:4310/helper>. The Android TV emulator is the primary working demonstration. If it is closed, keep `npm start` running and use `npm run android:run`.
3. Try **Live journeys** with the emulator’s D-pad: choose Green Park, review walking and direction, open each step, use Play/Pause for read-aloud, and save the route. This uses actual TfL data and makes no reservation.
4. In the separate **Booking lab**, try the disclosed changed-fare and lost-response scenarios in **Demo controls**. `README.md` explains the exact steps.
5. Review `docs/DEVPOST_DRAFT.md`, `docs/PRODUCT_FEEDBACK.md`, and `docs/VALIDATION.md` before approving submission materials.

## Included

Original source, Android Gradle wrapper, lockfile, MIT license, installable debug APK, narrated demo and transcript, actual screenshots, workflow/UI/emulator results, and REA quote evidence. `artifacts/review-manifest.json` lists file hashes. The ZIP's adjacent SHA-256 file identifies the archive.

Downloaded SDKs, emulator images, browsers, Node packages, local databases, tokens, debug signing keys, private configuration, caches, and raw media are excluded. `README.md` provides setup instructions for a fresh machine.

## Boundaries to keep in the pitch

The primary path plans real journeys between public London stations. The separate shuttle booking path remains fictional. Local mode needs the laptop awake; hosted mode uses the authorized Azure VM. No real ticketing or booking partner, older-adult study, physical Fire TV test, or universal website-learning claim is included. Read-aloud uses an offline Android voice or the macOS/Linux fallback. Hosted data is shared among invited reviewers.

The project has no paid AI/speech service; Azure hosting consumes Student credits. No Git repository or commits have been created. Public GitHub hosting, demo upload, and final Devpost submission await the builder's approval. The private Azure preview is already authorized and deployed. See `docs/AZURE_DEPLOYMENT.md`.

## Your self-test

The builder confirmed that only a self-test is available. Open **Usability sessions**, keep **Builder self-test** selected, agree to the observation, and follow `docs/USABILITY_PROTOCOL.md`. Stop the timer with the actual result. This provides builder feedback and remains separate from target-user validation.
