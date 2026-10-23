#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
cd "$HANDBACK_ROOT"
mkdir -p artifacts/raw
echo 'Recording emulator for 165 seconds. Perform the demo with the remote. This records the actual running Android application.'
adb shell screenrecord --bit-rate 6000000 --time-limit 165 /sdcard/handback-demo.mp4
adb pull /sdcard/handback-demo.mp4 artifacts/raw/handback-demo.mp4
echo 'Saved artifacts/raw/handback-demo.mp4'
