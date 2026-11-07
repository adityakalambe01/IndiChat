#!/usr/bin/env bash
# Linux x64 packaged smoke check under Docker/Rosetta; not a physical-host test.
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
release_dir="$(cd "${1:?Pass the Linux release directory containing the Debian package}" && pwd)"
packages=("$release_dir"/*.deb)
[[ ${#packages[@]} == 1 && -f "${packages[0]}" ]] || { echo 'Expected exactly one Debian package' >&2; exit 2; }
package_name="$(basename "${packages[0]}")"
results="$release_dir/runtime-$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$results"
cd "$root_dir"
docker build --platform linux/amd64 -f scripts/desktop-linux-verification.Dockerfile -t indichat-desktop-verification:phase3 .
# SYS_ADMIN is scoped to this throwaway container so Chromium can create its
# namespace sandbox. No --no-sandbox or host networking is used.
docker run --rm --platform linux/amd64 --cap-add=SYS_ADMIN \
  -v "$root_dir:/project:ro" -v "$release_dir:/packages:ro" -v "$results:/results" \
  -e INDICHAT_DEB_NAME="$package_name" indichat-desktop-verification:phase3 bash -lc '
    set -euo pipefail
    dpkg -i "/packages/$INDICHAT_DEB_NAME"
    chown 1001:1001 /results
    runuser -u verifier -- env HOME=/home/verifier XDG_DATA_DIRS=/usr/local/share:/usr/share \
      LIBGL_ALWAYS_SOFTWARE=1 INDICHAT_PACKAGED_APP=/opt/IndiChat/indichat \
      INDICHAT_TEST_OUTPUT=/results INDICHAT_TEST_USERDATA=/tmp/indichat-linux-smoke \
      xvfb-run -a dbus-run-session -- node /project/scripts/test-sandboxed-macos-native.cjs
  '
printf 'Results: %s\n' "$results"
