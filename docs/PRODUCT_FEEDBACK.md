# Product feedback — observed during this build

## Android TV emulator and Android SDK

**Use:** ran the actual installed TV application on Android TV API 33 ARM64, with a native launcher and remote-input integration.

**Worked:** the ARM64 image runs locally on Apple Silicon; ADB installs the debug APK and provides targeted device logs and screen captures. A complete hardware-free development path is possible.

**Friction:** command-line setup emitted a missing `devices.xml` message even though the AVD was created and booted. Recent command-line SDK metadata also produced a schema-version warning in the older pinned Android build tooling. These messages made it harder to distinguish fatal setup failures from compatible warnings.

**Suggestion:** distinguish successfully created devices from failed creation in the command's exit status and final summary, and provide a concise tested Apple Silicon TV setup with matching tool versions.

**Onboarding:** required a JDK, SDK packages, a TV system image, AVD creation, build tooling, and network configuration. We include a reproducible setup script.

**Use again:** yes, for repeatable remote-first development; physical Fire OS coverage remains a separate validation task.

## Android WebView and remote input

**Use:** served the TV interface inside a native application with D-pad/Select/Back dispatch and a local connection recovery screen.

**Worked:** standard web layout and DOM storage supported sharing a coherent interaction model between browser development and the TV app.

**Friction:** the logical viewport was 960×540 despite a 1920×1080 screenshot, and an older WebView asset persisted through rapid rebuilds. A focus selector also required an explicit priority rather than a union of selectors. Remote input must be intercepted consistently to avoid relying on desktop assumptions.

**Workaround:** compact TV layouts, synchronous focus updates, explicit native key dispatch, and no-store local development responses / no-cache WebView mode.

**Suggestion:** show logical CSS dimensions beside physical resolution in the device tooling and provide a minimal D-pad/WebView example that explains focus and key-event ownership.

**Use again:** yes for this constrained local prototype, with targeted TV and assistive-technology testing.

## REA 6.7.0

**Use:** ran a declared browser scenario against the rendered local reference provider and retained canonical DOM, accessibility, URL, execution status, and limitations as evidence.

**Worked:** the CLI could launch an explicitly selected browser and return an evidence ID and per-step completeness. This made the scope of the observed quote flow checkable.

**Friction:** command help's schema describes an opaque `inputJson` argument; the deeper scenario contract was needed to construct the action vocabulary. REA also required a newer Node runtime than the one initially on PATH.

**Suggestion:** link the concrete scenario contract directly from `capture-browser-scenario --help`, and show its nested schema or a minimal valid example there.

**Use again:** yes for bounded runtime investigations with retained evidence. We would not use it for ordinary source-repository reading or claim that a captured quote proves a completed booking.

## Playwright

**Use:** independent provider browser adapter; automated browser workflow and UI tests; experimental Android WebView inspection for native verification.

**Worked:** isolated contexts and deterministic locators made the independent provider boundary testable. Browser tests caught an actual semantic field-comparison bug.

**Friction:** generic desktop CDP connection attempted an unsupported browser-context operation on Android WebView. The Android API was the appropriate route. Modern role locators also used `Element.checkVisibility`, unavailable in the older emulator WebView, so device assertions use bounded DOM checks.

The optional native interaction driver required a separate Playwright Android download. Its legacy test APK was blocked by the emulator's Play Protect because of its older target. We left protections enabled and verified native pairing with standard ADB input and UI Automator hierarchy checks instead. The application itself installed and ran successfully.

**Suggestion:** provide a direct diagnostic for Android WebView CDP endpoints and an explicit minimum WebView version for locator helpers.

**Use again:** yes. Its Android support is experimental; our verification report identifies the APIs and environment actually used.

## Cost and runtime services

The core was built locally. The subsequent private preview uses Azure Student credits for a Linux VM, Docker Compose, and Caddy HTTPS. Chromium runs inside that VM; no paid AI inference or hosted browser vendor is used. No provider access, model availability, or AWS mini-challenge qualification is claimed.

## TfL Unified API — actual upgrade integration

**Use:** real public-station journey planning with a step-free routing preference. No API key, ticketing, or passenger details are involved.

**Worked:** documented anonymous access enabled a genuine free integration. The returned legs, directions, London-local times, and service alerts support a clear remote-first flow.

**Friction observed:** some station pairs took around twenty seconds while others returned in a few seconds. London Bridge produced no route within our configured walking/change limits. These are real upstream outcomes, not reasons to invent a more convenient route. Mode scope was narrowed to tube, bus, and walking for this pilot; requests have a bounded 25-second timeout and explicit unavailable/stale states.

**Suggestion:** document representative latency and make the no-offset London wall-clock convention prominent in journey examples. Return a concise explicit explanation when no option matches access preferences.

**Use again:** yes for public-data planning with visible freshness and conservative claims. The API is not a reservation provider or a lift-availability guarantee.

## Android speech and media — actual upgrade integration

**Use:** native TextToSpeech with installed offline English voices preferred; native MediaPlayer plays a short local WAV when the speech engine is unavailable.

**Friction observed:** an engine and reported voice could exist while actual synthesis still failed. Availability checks alone were insufficient. We handle the synthesis failure, then fall back to built-in macOS speech without requiring a paid service or changing emulator protections. Native player start/stop was verified through the real remote Play/Pause key.

**Suggestion:** expose whether a voice can actually synthesize locally and provide a clear, testable TV emulator voice setup. Treat voice failures as recoverable and preserve the visual task.

**Use again:** yes, with the fallback's platform dependency documented. The current macOS fallback is not a claim of portable production speech support on every host.
