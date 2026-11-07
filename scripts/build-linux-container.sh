#!/usr/bin/env bash
# Build x64 Linux packages without installing Linux tools on the macOS host.
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
build_output="$root_dir/apps/desktop/dist-bin-linux/$build_id"
release_output="$root_dir/release/linux/$build_id"
# Pinned image used by the local packaging verification. Native GUI testing is separate.
cd "$root_dir"
builder_image='indichat-desktop-verification:phase3'
electron_dist="${INDICHAT_ELECTRON_DIST:-}"
node "$root_dir/scripts/setup-build-packages.js"
project_cache="$root_dir/build_run_package"
electron_cache="$project_cache/electron"
builder_cache="$project_cache/electron-builder"
mkdir -p "$electron_cache" "$builder_cache"

extra_mounts=(
  -v "$electron_cache:/root/.cache/electron"
  -v "$builder_cache:/root/.cache/electron-builder"
)
if [[ -n "$electron_dist" ]]; then
  extra_mounts+=(-v "$(cd "$electron_dist" && pwd):/electron-dist:ro")
fi
cd "$root_dir"
npm --workspace=apps/web run build
mkdir -p "$build_output"
docker build --platform linux/amd64 -f scripts/desktop-linux-verification.Dockerfile -t "$builder_image" .
docker run --rm --platform linux/amd64 -e USE_SYSTEM_7ZA=true ${extra_mounts[@]+"${extra_mounts[@]}"} \
  -e ELECTRON_BUILDER_BINARIES_MIRROR \
  -v "$root_dir:/project:ro" -v "$build_output:/out" -w /work \
  "$builder_image" bash -lc '
    set -euo pipefail
    cp -a /project/apps/desktop/src /project/apps/desktop/assets \
      /project/apps/desktop/package.json /project/apps/desktop/electron-builder.json /work/
    cp -a /project/apps/web/dist /work/dist-web
    cp /project/LICENSE /LICENSE
    extra_args=()
    if [[ -d /electron-dist ]]; then extra_args=(--config.electronDist=/electron-dist); fi
    node /project/node_modules/electron-builder/cli.js --linux AppImage deb --x64 \
      --config.directories.output=/out ${extra_args[@]+"${extra_args[@]}"}
  '
node - "$build_output" "$release_output" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const { collectArtifacts } = require('./scripts/desktop-build-artifacts.cjs');
const artifacts = collectArtifacts(process.argv[2], process.argv[3], ['AppImage', 'deb']);
fs.writeFileSync(path.join(process.argv[3], 'manifest.json'), JSON.stringify({
  platform: 'linux', arch: 'x64', pathBase: 'project-root', nativeRuntimeVerified: false, artifacts
}, null, 2) + '\n');
console.log(JSON.stringify(artifacts, null, 2));
JS
