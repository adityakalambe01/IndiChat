# Phase 3 — local packaging and verification

Date: 2026-11-07. Branch: `feat/desktop-packaging-and-sandboxed-runtime`.

The available local work is complete. This is **not** full multi-platform release
approval: native Windows testing, physical Linux/AppImage/tray testing, and
external distribution signing remain open. The user confirmed no native test hosts
or signing credentials are available and requested completion of local work only.
Nothing was committed, uploaded, published, or deployed.

## Results

| Platform | Packaging | Executed verification | Remaining external gate |
|---|---|---|---|
| macOS ARM64 | Prior sandboxed DMG/ZIP preserved | Earlier native checks reused; no production app code changed in this task | Developer ID signing/notarization |
| Windows x64 | NSIS installer and portable EXE built, unsigned | Manifest hashes; PE branding/version/icon; bundled SPA; ASAR header hash; embedded payload archive integrity | Native install, runtime, restart, tray, uninstall and Authenticode signing |
| Linux x64 | AppImage and Debian package built | Debian install/uninstall; data-marker retention; identical ASAR in both packages; 19/19 GUI smoke checks in Docker/Rosetta/Xvfb | Physical Linux desktop/tray; direct AppImage/FUSE launcher; optional distribution signing |

The Linux smoke check used an isolated mock HTTP service on port 8195 inside a
throwaway container. It verifies the packaged renderer/proxy/IPC/UI flow and restart
configuration, not production authentication, two-way media, or banking services.
Window and external-link checks establish IPC dispatch, not actual tray or browser
outcomes. OS sandbox enforcement is not inferred from missing Node globals.
No sandbox-disabling switch was passed. The throwaway GUI container required
`SYS_ADMIN` to permit Chromium namespace creation; production configuration was
not altered. The run used unprivileged user `verifier` and an isolated user-data
path. Screenshots show the container's installed fonts, which lack some emoji.

## Generated artifacts

All paths are relative to repository root. Exact sizes and SHA-256 hashes are also
recorded in each release directory's `manifest.json`.

| File | Bytes | SHA-256 |
|---|---:|---|
| `release/windows/20261107T135607Z-11149/IndiChat-Setup-1.0.0.exe` | 139744726 | `705d735b9b77a73923abbf9961401e8d53cfd5e5c526ec85d36659780dbcda1a` |
| `release/windows/20261107T135607Z-11149/IndiChat-Portable-1.0.0.exe` | 139432296 | `90d2e6898bf99d0e829d4d84c6a17b340ca1ae9ea9464aabfcb57852e4b0229c` |
| `release/linux/20261107T133801Z-8713/IndiChat-1.0.0.AppImage` | 181723743 | `8f2422aa9c7d0d78a822dd913a392721c359520e1b6290925c4772fe23d6942c` |
| `release/linux/20261107T133801Z-8713/indichat_1.0.0_amd64.deb` | 127485942 | `836bf4df2b4079e4bf16382075ff74a3a6d2a3cb4435863626ff4555aaa634b3` |

Authoritative evidence:

- [Windows manifest](../../release/windows/20261107T135607Z-11149/manifest.json)
- [Windows static verification](../../release/windows/20261107T135607Z-11149/package-verification.json)
- [Windows embedded archive checks](../../release/windows/20261107T135607Z-11149/archive-verification.json)
- [Linux manifest](../../release/linux/20261107T133801Z-8713/manifest.json)
- [Linux package install/content verification](../../release/linux/20261107T133801Z-8713/package-verification.json)
- [Linux successful runtime results](../../release/linux/20261107T133801Z-8713/runtime-final/packaged-runtime-results.json)
- [Reusable-wrapper rerun: 19/19 passed](../../release/linux/20261107T133801Z-8713/runtime-20261107T140038Z-11658/packaged-runtime-results.json)

Earlier failed attempts are retained as diagnostics and are not successful runs.
The direct AppImage launcher returned exec-format error under Rosetta; its SquashFS
payload was extracted with `unsquashfs`, not by pretending the launcher ran.

## Fixes and reproducibility

- Both platform Electron runtimes were downloaded using a faster mirror after
  direct GitHub downloads stalled. SHA-256 matched the official Electron 33.4.11
  `SHASUMS256.txt` and the installed, lockfile-selected Electron package's manifest:
  Windows `f64c8a5a81d9b420b636fdba13e180f49d69f2198e1d86a8b01f858b17a9483c`;
  Linux `212d431c7c916292311c797cd91f84467c5abd6e6983cf24b162efff64cee8a9`.
- `INDICHAT_ELECTRON_DIST` optionally selects a pre-downloaded directory; the build
  rejects an archive that does not match the installed Electron checksum manifest.
- Linux build/runtime dependencies live in a local Docker image built from a pinned
  upstream base. Source mounts remain read-only; outputs use unique directories.
- Native macOS Windows cross-building failed on Intel-only Wine/NSIS binaries.
  Wine under Docker/Rosetta also failed. The explicit unsigned container path uses
  the installed `resedit`/`pe-library` dependencies to replace PE metadata/icons,
  preserving the Electron ASAR integrity resource. Regression tests check that
  the existing first icon group is replaced instead of leaving an Electron icon.
- The Windows container uses electron-builder 25.1.8's upstream JavaScript NSIS
  uninstaller reader instead of running a Windows bootstrapper under Wine. The
  local compatibility override is guarded to fail on an unreviewed builder upgrade.
  It does not edit installed dependencies. Native Windows builds keep the normal
  vendor path; the special path is explicitly unsigned and local-only.
- The shared packaged smoke runner now accepts executable/output/user-data paths,
  works with the installed `ws` 7 constructor on Node 20, logs native stderr,
  reports startup failures as failures, and labels Node isolation correctly.
- `verify-linux-package-install.sh` refuses to install/uninstall outside an explicitly
  disposable Docker container. The real Debian package identity is `indichat-desktop`.

Portable equivalents of the successful commands (run from the project root; place verified Electron archives in `./.cache/electron` or set another cache directory):

```bash
# Verified runtime directory is a local cache; it is not included in the repository.
INDICHAT_ELECTRON_DIST=./.cache/electron \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
bash scripts/build-linux-container.sh

INDICHAT_ELECTRON_DIST=./.cache/electron \
INDICHAT_BUILDER_CACHE="$HOME/Library/Caches/electron-builder" \
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
bash scripts/build-windows-container.sh

node scripts/verify-windows-package-content.cjs \
  apps/desktop/dist-bin-windows/20261107T135607Z-11149/win-unpacked \
  release/windows/20261107T135607Z-11149

node --experimental-test-coverage --test \
  scripts/test-desktop-build-artifacts.cjs scripts/test-windows-resources.cjs
npx tsc --project apps/mobile/tsconfig.json --noEmit
```

The package-content test and GUI test were executed with disposable `docker run`
commands; the final reusable GUI wrapper also completed with 19/19 passing checks
(`bash scripts/test-linux-packaged-container.sh release/linux/20261107T133801Z-8713`); reusable wrappers are `scripts/verify-linux-package-install.sh` and
`scripts/test-linux-packaged-container.sh`. The latter records new results under a
unique runtime directory and uses the same invocation as the successful run.

## Tests and preserved state

Ten Node tests passed. Helper/editor coverage: 91.86% lines, 80.65% branches,
90.91% functions. RED/GREEN evidence: new checksum tests failed before implementation;
the icon-group regression failed with two groups before the replacement logic was
corrected. Web production builds and mobile TypeScript validation passed. The web
build retains its existing large-chunk warning. Script syntax and diff whitespace
checks passed.

Both protected smartphone hashes are unchanged. No production backend, migrations,
shared contracts, mobile source, preview source, or runtime desktop source changed.
Existing macOS artifacts and review resources were left untouched. All containers
started by successful/failing verification commands used `--rm`; local build images,
verified runtime downloads, and output artifacts are retained. No CI was configured.

## Self-evaluation

| Axis | Score | Evidence / limit |
|---|---|---|
| Accuracy | 4/5 | Machine-readable evidence separates emulated, static and native checks; external native verification unavailable. |
| Completeness | 4/5 | All four missing package artifacts generated and local checks completed; signing/native hosts remain external. |
| Clarity | 4/5 | Commands, artifact hashes and limitations recorded; compatibility wrapper needs careful review on dependency upgrades. |
| Actionability | 4/5 | Local build/verification commands are reproducible; cached runtimes must be supplied or downloaded. |
| Conciseness | 4/5 | Final handoff is short; detailed evidence intentionally retained here. |

Overall: 4.0/5. Next improvements require native Windows/Linux hosts and signing
credentials. The user explicitly requested documenting these external blockers.

## Project-root path portability

Artifact manifests store paths as `./release/...` with `pathBase: "project-root"`.
Build and verification tools locate the project root from their own script directory,
not a hardcoded username or checkout location. Internal filesystem paths are resolved
at runtime. Existing manifest paths were normalized without changing binary contents
or hashes. A two-case regression first failed with absolute paths and then passed
after the collector update; the full packaging test set now contains 12 tests.
