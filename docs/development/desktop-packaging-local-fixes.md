# Local Phase 3 packaging fixes — 2026-11-07

## Changes

- Windows and Linux build scripts now use unique per-run build and release directories.
  They explicitly target x64 and collect only the requested package types.
- Missing targets fail instead of printing a successful release summary. Existing
  release artifacts cannot be overwritten by the collector.
- Successful collection writes a manifest with paths, byte sizes and SHA-256 hashes.
  Native runtime verification is explicitly false in build manifests.
- A pinned Linux container command is available as
  `bash scripts/build-linux-container.sh`. It mounts source read-only and writes to
  a new output directory. It builds from the freshly compiled web distribution.
- The verification plan no longer suggests disabling the renderer sandbox or
  running the macOS-specific runtime harness on Windows/Linux.

## Executed checks

- RED: artifact regression test initially failed because the collector was absent.
- GREEN: `node --experimental-test-coverage --test scripts/test-desktop-build-artifacts.cjs`
  passed 5 tests; collector line, branch and function coverage were all 100%.
- `node --check scripts/build-windows.js` and `node --check scripts/build-linux.js`: passed.
- `bash -n scripts/build-linux-container.sh`: passed.
- The Windows build ran the production web build successfully twice.
- `npx tsc --project apps/mobile/tsconfig.json --noEmit`: passed.
- Task-specific whitespace checks passed. The whole working tree has a pre-existing
  extra blank line at the end of docs/api-contracts.md; it was left unchanged.
- Smartphone preview SHA-256 hashes match the recorded protected baselines.

## Actual package attempts

Windows portable x64 and Linux AppImage/Debian x64 packaging reached the official
Electron runtime download. The first Linux attempt failed on chmod against a
read-only archive binary; using the container's system 7za resolved that error.
The Linux x64 builder image was downloaded and executed through Docker emulation.

Dependency downloads did not complete. A separate bounded download from the
same official Windows Electron release timed out after 120 seconds with 81,911
of 115,028,145 bytes received (681 bytes/second). Both packaging jobs started in
this turn were stopped; only the temporary Linux build container was removed.
No Windows/Linux package or native runtime success is claimed.

The downloaded builder image and incomplete build/download directories are retained.
No existing review services were started, stopped or migrated. Prior macOS packages,
production sandbox settings, migrations, and smartphone previews were not changed.
No remote CI was configured, and nothing was committed or published.

## Remaining gates

- Complete platform-runtime dependency downloads and package builds.
- Run Windows and Linux application journeys on suitable native hosts. A Linux
  build container on Apple Silicon does not establish native Linux GUI behavior.
- Obtain distribution signing/notarization credentials separately if distribution
  is authorized. Phase 3 remains incomplete.

## ECC self-evaluation

| Axis | Score | Evidence / improvement |
|---|---|---|
| Accuracy | 4/5 | Actual failures and executed checks are separated; full installer execution remains untested. |
| Completeness | 3/5 | Local packaging defects fixed; downloads, native Windows/Linux checks and signing remain external gates. |
| Clarity | 4/5 | Commands and blocker are recorded; no native runtime claim is inferred from packaging. |
| Actionability | 4/5 | Reproducible build commands and per-build manifests are available; dependencies still need to download. |
| Conciseness | 4/5 | Shared collector avoids duplicated collection logic; legacy build-script boilerplate remains. |

Overall: 3.8/5. Highest-impact next improvements are completing dependency downloads,
then executing native package journeys. Would the user agree? The local fixes are
reviewable, but this is explicitly not a complete Phase 3 delivery.
