# build_run_package

This directory stores project-local prebuilt packages, Electron platform binaries, and packaging toolchains across devices.

## Purpose

Instead of downloading 100MB+ binaries to random global locations (`~/.cache/electron`, `~/Library/Caches/`), all desktop build scripts in IndiChat automatically read from and write to this directory:

- `build_run_package/electron/`: Contains prebuilt Electron zip packages (e.g. `electron-v33.4.11-darwin-arm64.zip`, `electron-v33.4.11-win32-x64.zip`, `electron-v33.4.11-linux-x64.zip`).
- `build_run_package/electron-builder/`: Contains builder utilities (`nsis`, `winCodeSign`, `wine`).

## Commands

Check current cached package status:
```bash
npm run packages:status
```

Pre-fetch / download all required platform packages into this directory:
```bash
npm run packages:download
```

## Build Automation

All build scripts (`scripts/build-macos.js`, `scripts/build-windows.js`, `scripts/build-linux.js`, and containerized builds) automatically mount and read from this directory. Any newly downloaded package will be stored here and reused for future builds on this device without re-downloading.
