# Demonstration recording — final landscape edit

The preferred film is **artifacts/handback-tv-judges-demo.mp4**, approximately **2 minutes 13 seconds**, 1920×1080 H.264 with AAC audio. It uses bold beat-aligned chapters, full-frame actual app footage, Kokoro synthetic narration, and quieter instrumental music beneath speech. It remains unpublished.

The original capture shows the private Azure cloud APK on an Android TV API 33 ARM64 emulator. D-pad and Play/Pause events are actual inputs. TfL routes are genuine point-in-time service responses. The separate Willow Link lab is fictional, its ₹20 fare change is deliberately injected, and its receipt comes from independently stored test-provider data. No real ticket, payment or reservation is made. Captions and source labels distinguish the workflows.

Device audio is not captured. The film explains the independently verified read-aloud control without pretending that narration is the device voice. Kokoro af_heart is locally synthesized and is not cloned from a person. Only builder and emulator tests are claimed; no target-user results are claimed.

Music: Phonk Execution by Alex-Productions, CC BY 3.0. The complete mandatory publishing credit is in artifacts/handback-tv-video-description.txt. Include that credit unchanged when uploading. Music is excerpted, looped, ducked and faded. Audio levels are measured; the agent has not listened to the final mix.

Captions: artifacts/handback-tv-judges-demo.srt. Thumbnail: artifacts/handback-tv-judges-demo.jpg. Editable production source: brag-output/judges-demo; timeline: brag-output/demo-edit.json; builder: scripts/build-brag-demo.py. Hyperframes 0.8.186 performs the final render after its full browser check. The Brag skill is installed at ~/.codex/skills/brag. See brag-output/judges-demo/REVIEW.md for production decisions and retained warnings.

## Earlier review draft (retained for reference)


`artifacts/handback-tv-demo-review.mp4` is the completed local **2-minute-38-second** review draft: 1920×1080 H.264 video with English AAC narration. It remains unpublished.

## Actual sources

- A captured helper **Live journeys** setup screen opens the video.
- Actual Android TV API 33 ARM64 emulator screen recording shows real TfL planning, remote route review, Play/Pause read-aloud, local route saving, and a separate fictional booking demonstration.
- The final frame shows the local observation tool with no participant results claimed.
- Original narration is rendered using the built-in macOS Samantha synthetic voice. There is no music, testimonial, actor footage, or copied video. `artifacts/demo-transcript.txt` retains the words; `artifacts/demo-captions.srt` provides optional English captions.

The recording uses actual Android D-pad and Media Play/Pause events for the primary workflows. At raw-recording second 76 (final-video second 88), the test navigates to the separate booking lab. Its fare change is explicitly injected through the local demo API. `artifacts/raw/upgrade-timeline.json` retains the actual action times. The raw recording is padded by holding its final captured frame to cover the planned narration; it is not fabricated application footage.

The screen recording has no captured device audio. The added narration explains the demonstrated read-aloud control; actual native audio start and stop were independently checked in `artifacts/live-emulator-verification.json`. TfL journey data is genuine, point-in-time information. The booking provider is fictional, and no ticket, payment, or live reservation is involved. A persistent label identifies the emulator, real TfL data, and fictional booking lab.

## Reproduce

With the local service, paired app, and emulator running:

```bash
npx tsx scripts/record-upgrade.ts
npm run demo:compose
python3 scripts/create-captions.py
```

The recording script warms the documented short TfL cache with a genuine request, preserves its fetched timestamp, and then records the take. It may fail if the provider is unavailable; it never silently substitutes a fixture. The script also resets only the fictional booking lab before its test.

Composition requires Python 3, FFmpeg, ImageMagick, and the named macOS voice. These are optional media-authoring tools. Intermediate media remains under ignored `artifacts/raw/`, excluded from the source review ZIP. The original reference-only `demo:walkthrough` script remains available for development; the upgraded composition uses `record-upgrade.ts` footage.

Review all media before approving any public upload.
