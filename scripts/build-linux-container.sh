#!/usr/bin/env bash
# Build x64 Linux packages without installing Linux tools on the macOS host.
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
build_output="$root_dir/apps/desktop/dist-bin-linux/$build_id"
release_output="$root_dir/release/linux/$build_id"
# Pinned image used by the local packaging verification. Native GUI testing is separate.
builder_image='electronuserland/builder@sha256:d11de66bf94805f9df748f5e4614858ced7b90ad7f309f29af720ed8bce392a5'
cd "$root_dir"
npm --workspace=apps/web run build
mkdir -p "$build_output"
docker run --rm --platform linux/amd64 -e USE_SYSTEM_7ZA=true \
  -v "$root_dir:/project:ro" -v "$build_output:/out" -w /work \
  "$builder_image" bash -lc '
    cp -a /project/apps/desktop/src /project/apps/desktop/assets \
      /project/apps/desktop/package.json /project/apps/desktop/electron-builder.json /work/
    cp -a /project/apps/web/dist /work/dist-web
    cp /project/LICENSE /LICENSE
    node /project/node_modules/electron-builder/cli.js --linux AppImage deb --x64 \
      --config.directories.output=/out
  '
node - "$build_output" "$release_output" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const { collectArtifacts } = require('./scripts/desktop-build-artifacts.cjs');
const artifacts = collectArtifacts(process.argv[2], process.argv[3], ['AppImage', 'deb']);
fs.writeFileSync(path.join(process.argv[3], 'manifest.json'), JSON.stringify({
  platform: 'linux', arch: 'x64', nativeRuntimeVerified: false, artifacts
}, null, 2) + '\n');
console.log(JSON.stringify(artifacts, null, 2));
JS
