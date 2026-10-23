#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
cd "$HANDBACK_ROOT"
if ! adb devices | grep -q 'emulator-.*device'; then
  emulator -avd Handback_TV -no-boot-anim -no-snapshot -gpu auto > .tools/emulator.log 2>&1 &
fi
adb wait-for-device
for attempt in $(seq 1 90); do
  [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
  sleep 1
done
adb install -r artifacts/handback-tv-debug.apk
adb shell am start -n com.handback.tv/.MainActivity
