# Local-only packaging/runtime tools. Never used as the application image.
FROM electronuserland/builder@sha256:d11de66bf94805f9df748f5e4614858ced7b90ad7f309f29af720ed8bce392a5
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    p7zip-full squashfs-tools xvfb xauth dbus-x11 libgtk-3-0 libnss3 libasound2 libgbm1 \
    libxss1 libxtst6 libnotify4 libdrm2 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1001 verifier
