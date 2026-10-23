#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
cd "$HANDBACK_ROOT"
if [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo 'JDK 17 is required. On an Apple Silicon Mac: brew install openjdk@17'
  echo 'Alternatively set JAVA_HOME to your existing JDK 17 installation.'
  exit 1
fi
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo 'This bootstrap is tested on Apple Silicon macOS. Use Android Studio Device Manager on other systems (see README).'
  exit 1
fi
mkdir -p .tools/downloads "$ANDROID_HOME/cmdline-tools"
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fL --retry 2 -o .tools/downloads/android-tools.zip https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip
  unzip -q .tools/downloads/android-tools.zip -d .tools/downloads/android-tools
  mv .tools/downloads/android-tools/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
fi
# sdkmanager displays the applicable Android package licenses for interactive review.
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" 'platform-tools' 'emulator' 'platforms;android-34' 'build-tools;34.0.0' 'system-images;android-33;android-tv;arm64-v8a'
if ! emulator -list-avds | grep -qx Handback_TV; then
  printf 'no\n' | avdmanager create avd -n Handback_TV -k 'system-images;android-33;android-tv;arm64-v8a' -d tv_1080p
fi
npm run android:build
echo 'Android tools and Handback APK are ready. Start npm start in another terminal, then npm run android:run.'
