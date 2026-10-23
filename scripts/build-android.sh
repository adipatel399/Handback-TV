#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
cd "$HANDBACK_ROOT"
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
if [ -x "$HANDBACK_ROOT/.tools/gradle-8.9/bin/gradle" ]; then
  "$HANDBACK_ROOT/.tools/gradle-8.9/bin/gradle" -p android assembleDebug
else
  android/gradlew -p android assembleDebug
fi
mkdir -p artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/handback-tv-debug.apk
