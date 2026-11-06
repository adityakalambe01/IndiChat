# IndiChat Linux Desktop & Store Distribution Guide

> **IndiChat** for Linux is a high-performance desktop application built with Electron, React 19, and native Linux desktop integration. It supports direct execution, system tray presence, hardware-accelerated audio/video WebRTC calling, and packaging for all major Linux distribution channels and software stores.

---

## 1. Architecture & Linux Integration Overview

The desktop client lives under [`apps/desktop`](../apps/desktop) in the monorepo and integrates seamlessly with [`apps/web`](../apps/web):

- **Embedded Local Proxy Engine**: Bundled with a lightweight, zero-dependency Node HTTP/WebSocket proxy server (`src/server.cjs`) that serves static React web assets and seamlessly proxies `/api` and `/ws` to the backend (default `http://localhost:8080`).
- **Native Wayland & X11 Support**: Runs natively under modern Wayland display servers as well as X11 desktop environments (GNOME, KDE Plasma, XFCE, Cinnamon).
- **System Tray Integration**: Background tray icon with one-click window toggle and quit controls.
- **Media & Hardware Permissions**: Automatically requests and handles microphone, camera, and notification permissions for instant messaging and audio/video calls.
- **Single Instance Lock**: Ensures only one desktop window instance runs at a time, bringing the existing window to focus if invoked again.

---

## 2. Release Artifacts Directory

When compiled, all Linux distribution packages and store submission manifests are automatically generated into [`release/linux/`](../release/linux/):

| Artifact | Format | Description / Target |
| :--- | :--- | :--- |
| `IndiChat-1.0.0.AppImage` | Standalone Executable | Runs on any Linux distribution without installation |
| `indichat_1.0.0_amd64.deb` | Debian / Ubuntu Package | Native package for Ubuntu, Debian, Linux Mint, Pop!_OS |
| `indichat-1.0.0-linux-x64.tar.gz` | Compressed Tarball | Portable archive with standalone binaries |
| `indichat_1.0.0_amd64.snap` | Canonical Snap Package | Package for the Ubuntu App Center & Snap Store |
| `indichat.desktop` | XDG Desktop Entry | Standard Freedesktop shortcut for application menus |
| `org.indichat.IndiChat.metainfo.xml` | AppStream Metadata | Store listing metadata for Flathub, GNOME Software, KDE Discover |
| `org.indichat.IndiChat.yml` | Flatpak Manifest | Flathub packaging manifest |
| `snapcraft.yaml` | Snapcraft Manifest | Canonical Snap Store build recipe |

---

## 3. How to Build Linux Packages

Build scripts are orchestrated through [`scripts/build-linux.js`](../scripts/build-linux.js) and accessible via root npm scripts:

```bash
# 1. Build all primary Linux distribution packages (AppImage, deb, tar.gz):
npm run build:linux

# 2. Build AppImage standalone binary only:
npm run build:linux:appimage

# 3. Build Debian / Ubuntu package only:
npm run build:linux:deb

# 4. Build Snap package only:
npm run build:linux:snap

# 5. Clean caches and build all packages:
node scripts/build-linux.js --clean
```

---

## 4. How to Run on Linux

### A. Run Standalone AppImage (Zero Install)

The AppImage can be run immediately on any modern Linux distribution:

```bash
# Ensure execution permissions:
chmod +x release/linux/IndiChat-1.0.0.AppImage

# Launch IndiChat:
./release/linux/IndiChat-1.0.0.AppImage
```

*(You can also double-click `IndiChat-1.0.0.AppImage` directly inside your desktop file manager).*

### B. Install on Ubuntu / Debian / Pop!_OS / Linux Mint

```bash
# Install the .deb package:
sudo dpkg -i release/linux/indichat_1.0.0_amd64.deb

# Fix missing shared libraries if prompted:
sudo apt-get install -f

# Launch from terminal or Application Menu:
indichat
```

### C. Run Development Mode

To launch the desktop client with live hot-module replacement during development:

```bash
# Terminal 1: Launch backend (Spring Boot)
npm run backend:run

# Terminal 2: Launch desktop app
npm run desktop:linux
```

---

## 5. Publishing to Linux App Stores

### 🏪 Store 1: Canonical Snap Store (Ubuntu App Center)

The Canonical Snap Store powers the default **App Center** on Ubuntu 20.04, 22.04, 24.04, and 26.04 LTS.

#### Step 1: Install Snapcraft CLI & Register Account

```bash
sudo snap install snapcraft --classic
snapcraft login
```

#### Step 2: Register App Name

```bash
snapcraft register indichat
```

#### Step 3: Build & Release Snap Package

```bash
# Build the snap package using the automated build script:
npm run build:linux:snap

# Upload and release to the stable channel:
snapcraft upload --release=candidate,stable release/linux/indichat_1.0.0_amd64.snap
```

Once uploaded, your application appears automatically in the Ubuntu Software / App Center for millions of Ubuntu users.

---

### 🌐 Store 2: Flathub (Flatpak)

Flathub is the universal Linux application store supported out-of-the-box by **Fedora, Steam Deck (SteamOS), Endless OS, Linux Mint, Zorin OS, Arch Linux, and Pop!_OS**.

#### Step 1: Verify Metadata & Flatpak Manifest

IndiChat includes preconfigured Flatpak manifests ready for submission:

- Manifest: [`release/linux/org.indichat.IndiChat.yml`](../release/linux/org.indichat.IndiChat.yml)
- AppStream metadata: [`release/linux/org.indichat.IndiChat.metainfo.xml`](../release/linux/org.indichat.IndiChat.metainfo.xml)
- Desktop entry: [`release/linux/indichat.desktop`](../release/linux/indichat.desktop)

#### Step 2: Test Flatpak Build Locally

```bash
# Install flatpak and flatpak-builder:
sudo apt install flatpak flatpak-builder

# Install Freedesktop runtime 24.08:
flatpak install flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08

# Test local build:
flatpak-builder --user --install --force-clean build-dir release/linux/org.indichat.IndiChat.yml

# Run locally to test:
flatpak run org.indichat.IndiChat
```

#### Step 3: Submit to Flathub

1. Fork the [Flathub repository](https://github.com/flathub/flathub) on GitHub.
2. Create a new branch named `org.indichat.IndiChat`.
3. Add `org.indichat.IndiChat.yml` and `org.indichat.IndiChat.metainfo.xml`.
4. Open a Pull Request on GitHub to `flathub/flathub`. The Flathub automated bot will test build and publish your app.

---

### 🚀 Store 3: AppImageHub & GitHub Releases

1. Create a new release tag on GitHub (e.g., `v1.0.0`).
2. Attach `release/linux/IndiChat-1.0.0.AppImage` as a release binary asset.
3. Submit a 1-line metadata pull request to [AppImage/appimage.github.io](https://github.com/AppImage/appimage.github.io) linking your repository. IndiChat will be listed on **AppImageHub**.

---

## 6. Wayland & Hardware Acceleration Flags

If running on pure Wayland without XWayland, or for low-power GPU decoding:

```bash
# Native Wayland window rendering:
./release/linux/IndiChat-1.0.0.AppImage --enable-features=UseOzonePlatform --ozone-platform=wayland

# Hardware video acceleration:
./release/linux/IndiChat-1.0.0.AppImage --enable-features=VaapiVideoDecoder
```
