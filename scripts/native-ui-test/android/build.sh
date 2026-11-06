#!/bin/bash
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/../../.." && pwd)"
output_dir="${1:-/tmp/indichat-runtime-followup/android-ui-driver}"
sdk_dir="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
build_tools="$sdk_dir/build-tools/37.0.0"
export JAVA_HOME=/opt/homebrew/Cellar/openjdk@21/21.0.13.0.2/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p "$output_dir/classes" "$output_dir/dex"
javac -source 17 -target 17 -cp "$sdk_dir/platforms/android-37.0/android.jar" -d "$output_dir/classes" "$root_dir/scripts/native-ui-test/android/Driver.java"
jar cf "$output_dir/driver.jar" -C "$output_dir/classes" .
"$build_tools/d8" --lib "$sdk_dir/platforms/android-37.0/android.jar" --output "$output_dir/dex" "$output_dir/driver.jar"
"$build_tools/aapt2" link -I "$sdk_dir/platforms/android-37.0/android.jar" --manifest "$root_dir/scripts/native-ui-test/android/AndroidManifest.xml" -o "$output_dir/driver-unsigned.apk"
(cd "$output_dir/dex" && zip -q "$output_dir/driver-unsigned.apk" classes.dex)
"$build_tools/apksigner" sign --ks "$root_dir/apps/mobile/android/app/debug.keystore" --ks-pass pass:android --key-pass pass:android --out "$output_dir/driver.apk" "$output_dir/driver-unsigned.apk"
echo "$output_dir/driver.apk"
