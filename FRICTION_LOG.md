# Development friction log

Record only problems actually encountered. This blank template contains no claimed product feedback or measured results.

## Entry template

- Date and tool/API/SDK version:
- Task attempted:
- Relevant documentation URL:
- Exact reproduction steps:
- Expected result:
- Actual result:
- Severity and effect on the build:
- Supporting evidence, sanitized:
- Workaround used:
- Actionable improvement suggestion:
- Retest result:

## Final feedback for each tool used

- What we used it for:
- What worked well:
- What needs improvement:
- Onboarding experience:
- Would we use it again, and why:

## Evidence index

| Claim or issue | Evidence file / REA ID | Observed, inferred, or unknown | Version / target | Remaining limitation |
|---|---|---|---|---|

## Evaluation results

| Case | Input and target version | Expected behavior | Actual behavior | Pass/fail | Duration | Evidence |
|---|---|---|---|---|---|---|

## Observed build entries — 22 October 2026

### Android TV logical viewport and focus

- Task: run the installed application on an Android TV API 33 ARM64 emulator.
- Expected: desktop TV layout fits the emulator's 1080p display and focuses the intended first control.
- Actual: its logical WebView viewport was 960×540; the initial interface overflowed. A selector union returned the earlier Back button instead of prioritizing the marked initial control.
- Severity: high for remote usability.
- Workaround: compact TV layouts, explicit selector priority, synchronous focus updates, and native key-event dispatch.
- Retest: browser viewport-fit test and actual emulator D-pad booking passed. See `artifacts/ui-verification.json` and `artifacts/emulator-verification.json`.
- Suggestion: show logical viewport dimensions in emulator tooling and provide a small WebView/TV focus example.

### Rapid local WebView rebuilds

- Task: reload the Android TV client after rebuilding the web interface.
- Expected: newly emitted hashed assets load.
- Actual: an older index/asset combination remained visible during rapid rebuilds.
- Severity: medium; obscured whether a focus fix was present.
- Workaround: no-store headers for this local prototype and WebView LOAD_NO_CACHE; inspect the actual loaded script identity during verification.
- Retest: the installed build completed its remote-only booking.
- Suggestion: a clear cache-bypass option in the TV debugging workflow.

### REA browser-scenario onboarding

- Task: construct a scoped browser capture using REA 6.7.0.
- Expected: command help exposes the scenario input structure.
- Actual: schema help exposed an opaque inputJson argument. The nested action vocabulary required reading the separate browser-scenario contract. The initial Node 22.14 runtime was below REA's requirement.
- Severity: low/medium.
- Workaround: explicit contract example; bundled Node 24.19 runtime; pinned package and selected Chromium executable.
- Retest: canonical evidence `ev_bb4f2a78cc2db2604e93f02696e2679ed10aa58bae54ba0498d83d73985ca2a0` captured the declared quote scenario.
- Suggestion: a minimal valid nested example and runtime preflight in command help.

### Android WebView verification API

- Task: inspect our own WebView while sending Android remote inputs.
- Expected: generic CDP connection works like desktop Chromium.
- Actual: browser context management was unsupported; modern role locator checks also required a visibility method absent in the older WebView.
- Severity: medium for testing.
- Workaround: Playwright's Android WebView API and bounded DOM assertions; keep primary actions as Android D-pad inputs.
- Retest: actual emulator verification passed.
- Suggestion: clearer endpoint diagnostics and explicit WebView-version requirements.

Full product feedback for each tool used is in `docs/PRODUCT_FEEDBACK.md`. These are development observations, not customer feedback or invented usability findings.

## 23 October — real journey upgrade

- Task: request supported public-station routes from TfL. Expected: responsive real data. Actual: Green Park and Westminster returned in a few seconds; London Bridge took about twenty seconds and produced no route within configured limits. Workaround: relevant mode scope, bounded timeout, caching/coalescing, explicit no-match/error states. Suggestion: document latency and provide a clear constraints/no-results explanation. Severity: medium.
- Task: display multiple actual routes in the TV emulator. Expected: the same 960×540 fit as a one-option fixture. Actual: the longer real route list overflowed. Workaround: present up to two matching choices and verify actual device dimensions. Suggestion: include multi-result compact-viewport examples. Severity: medium.
- Task: read a current instruction aloud. Expected: a reported Android voice would synthesize. Actual: the engine/voice appeared available but synthesis returned an error. Workaround: handle the real failure and stream locally synthesized macOS WAV into native MediaPlayer; verify native Play/Pause start/stop. Suggestion: separate reported voice presence from usable offline synthesis. Severity: medium.
