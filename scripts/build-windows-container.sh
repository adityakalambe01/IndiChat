#!/usr/bin/env bash
# Explicit unsigned local cross-build. Does not establish native Windows behavior.
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"
build_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
build_output="$root_dir/apps/desktop/dist-bin-windows/$build_id"
release_output="$root_dir/release/windows/$build_id"
builder_image='indichat-desktop-verification:phase3'
node "$root_dir/scripts/setup-build-packages.js"
project_cache="$root_dir/build_run_package"
electron_cache="$project_cache/electron"
builder_cache="$project_cache/electron-builder"
mkdir -p "$electron_cache" "$builder_cache"

extra_mounts=(
  -v "$electron_cache:/root/.cache/electron"
  -v "$builder_cache:/root/.cache/electron-builder"
  -v "$builder_cache:/host-builder-cache:ro"
)
if [[ -n "$electron_dist" ]]; then
  electron_dist="$(cd "$electron_dist" && pwd)"
  node - "$electron_dist" <<'JS'
require('./scripts/desktop-build-artifacts.cjs').verifyElectronDist(process.argv[2], 'win32');
JS
  extra_mounts+=(-v "$electron_dist:/electron-dist:ro")
fi
npm --workspace=apps/web run build
mkdir -p "$build_output"
docker build --platform linux/amd64 -f scripts/desktop-linux-verification.Dockerfile -t "$builder_image" .
docker run --rm --platform linux/amd64 ${extra_mounts[@]+"${extra_mounts[@]}"} \
  -e ELECTRON_BUILDER_BINARIES_MIRROR -e CSC_IDENTITY_AUTO_DISCOVERY=false \
  -v "$root_dir:/project:ro" -v "$build_output:/out" -w /work \
  "$builder_image" bash -lc '
    set -euo pipefail
    cp -a /project/apps/desktop/src /project/apps/desktop/assets \
      /project/apps/desktop/package.json /project/apps/desktop/electron-builder.json /work/
    cp -a /project/apps/web/dist /work/dist-web
    cp /project/LICENSE /LICENSE
    if [[ -d /host-builder-cache/nsis ]]; then
      mkdir -p /root/.cache/electron-builder
      cp -a /host-builder-cache/nsis /root/.cache/electron-builder/
    fi
    cp /project/node_modules/7zip-bin/linux/x64/7za /tmp/indichat-7za
    cp /project/node_modules/7zip-bin/7x.sh /tmp/indichat-7x.sh
    chmod +x /tmp/indichat-7za /tmp/indichat-7x.sh
    cat > /work/build.cjs <<"JS"
const tools = require("/project/node_modules/7zip-bin");
tools.path7za = "/tmp/indichat-7za";
tools.path7x = "/tmp/indichat-7x.sh";
// The electron-builder 25 portable JS uninstaller reader avoids executing a
// Windows bootstrapper under Wine. Its only caller is the NSIS target.
if (require("/project/node_modules/app-builder-lib/package.json").version !== "25.1.8") {
  throw new Error("Revalidate the JS uninstaller path after an electron-builder upgrade");
}
require("/project/node_modules/app-builder-lib/out/util/macosVersion.js").isMacOsCatalina = () => true;
console.log("Unsigned cross-build: JS resource editing and upstream JS NSIS uninstaller extraction");
require("/project/node_modules/electron-builder/cli.js");
JS
    extra_args=()
    if [[ -d /electron-dist ]]; then extra_args=(--config.electronDist=/electron-dist); fi
    node /work/build.cjs --win nsis portable --x64 \
      --config.win.signAndEditExecutable=false \
      --config.afterPack=/project/scripts/edit-windows-resources.cjs \
      --config.directories.output=/out ${extra_args[@]+"${extra_args[@]}"}
  '
node - "$build_output" "$release_output" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const { collectArtifacts } = require('./scripts/desktop-build-artifacts.cjs');
const artifacts = collectArtifacts(process.argv[2], process.argv[3], ['nsis', 'portable']);
fs.writeFileSync(path.join(process.argv[3], 'manifest.json'), JSON.stringify({
  platform: 'windows', arch: 'x64', pathBase: 'project-root', buildEnvironment: 'Linux container; unsigned JS resource/uninstaller path',
  nativeRuntimeVerified: false, signed: false, artifacts
}, null, 2) + '\n');
console.log(JSON.stringify(artifacts, null, 2));
JS
