#!/usr/bin/env bash
# Run only in a throwaway Linux container, never on a user's installed desktop.
set -euo pipefail
[[ "$(uname -s)" == Linux && -f /.dockerenv && "${INDICHAT_DISPOSABLE_CONTAINER:-}" == 1 ]] || {
  echo 'Refusing package install/uninstall outside an explicitly disposable Docker container.' >&2
  exit 2
}
deb_package="${1:?Pass the Debian package path}"
appimage_package="${2:?Pass the AppImage package path}"
result_file="${3:?Pass a results JSON path}"
package_name="$(dpkg-deb -f "$deb_package" Package)"
[[ "$package_name" == indichat-desktop ]] || { echo 'Unexpected package identity' >&2; exit 1; }
dpkg -i "$deb_package"
test -x /usr/bin/indichat
test -f /opt/IndiChat/resources/app.asar
extract_dir="$(mktemp -d /tmp/indichat-appimage-XXXXXX)"
cd "$extract_dir"
# Extract the SquashFS payload directly: Rosetta does not execute the AppImage
# launcher on this host. Extraction is a package-content check, not a launch test.
squashfs_offset="$(node - "$appimage_package" <<'JS'
const data = require('node:fs').readFileSync(process.argv[2]);
let offset = -1;
while ((offset = data.indexOf('hsqs', offset + 1)) !== -1) {
  if (offset + 96 <= data.length && data.readUInt16LE(offset + 28) === 4 && data.readUInt16LE(offset + 30) === 0) {
    process.stdout.write(String(offset)); process.exit(0);
  }
}
throw new Error('SquashFS v4 payload missing');
JS
)"
unsquashfs -o "$squashfs_offset" -d squashfs-root "$appimage_package" > /tmp/indichat-appimage-extraction.log
test -x squashfs-root/indichat
test -f squashfs-root/resources/app.asar
cmp squashfs-root/resources/app.asar /opt/IndiChat/resources/app.asar
# An uninstall must not delete the user's journal/configuration directory.
retained_data=/home/verifier/.config/indichat-desktop/phase3-retention-marker
mkdir -p "$(dirname "$retained_data")"
printf '%s\n' 'disposable verification data' > "$retained_data"
dpkg -r "$package_name"
test ! -e /usr/bin/indichat
test ! -e /opt/IndiChat/indichat
test -f "$retained_data"
node - "$result_file" "$package_name" <<'JS'
require('node:fs').writeFileSync(process.argv[2], JSON.stringify({
  environment: 'disposable Linux x64 container under macOS Docker/Rosetta',
  packageName: process.argv[3],
  debInstall: true, executableAndBundlePresent: true,
  appImageSquashfsExtraction: true, appImageLauncherVerified: false, sameAsarInBothPackages: true,
  debUninstall: true, userDataMarkerRetained: true,
  graphicalRuntimeVerified: false
}, null, 2) + '\n');
JS
