import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    indichatDesktop?: {
      isDesktop: boolean;
      platform: string;
      version: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openExternal: (url: string) => void;
      getServerUrl?: () => Promise<string>;
      setServerUrl?: (url: string) => Promise<boolean>;
    };
    electronAPI?: {
      isDesktop: boolean;
      platform: string;
      version: string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

export type DesktopPlatform = 'darwin' | 'win32' | 'linux' | 'web';

interface DesktopWindowChromeProps {
  forcedPlatform?: DesktopPlatform;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
  onOpenHelp?: () => void;
}

export const DesktopWindowChrome: React.FC<DesktopWindowChromeProps> = ({
  forcedPlatform,
  onOpenSettings,
  onOpenShortcuts,
  onOpenHelp,
}) => {
  const [platform, setPlatform] = useState<DesktopPlatform>(() => {
    if (forcedPlatform) return forcedPlatform;

    // 1. Explicit query param for preview emulation ?platform=macos | windows | linux | web
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const param = urlParams.get('platform');
      if (param === 'macos' || param === 'darwin') return 'darwin';
      if (param === 'windows' || param === 'win32') return 'win32';
      if (param === 'linux') return 'linux';
      if (param === 'web') return 'web';
    }

    // 2. Native Desktop environment detection
    const desktop = window.indichatDesktop || window.electronAPI;
    if (desktop?.platform === 'darwin' || desktop?.platform === 'macos') return 'darwin';
    if (desktop?.platform === 'win32' || desktop?.platform === 'windows') return 'win32';
    if (desktop?.platform === 'linux') return 'linux';

    // 3. User agent fallback
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      if (/Macintosh|Mac OS X/i.test(userAgent)) return 'darwin';
      if (/Windows/i.test(userAgent)) return 'win32';
      if (/Linux/i.test(userAgent)) return 'linux';
    }

    return 'darwin';
  });

  const isNativeMacElectron = typeof window !== 'undefined' &&
    Boolean(window.indichatDesktop?.isDesktop || window.electronAPI?.isDesktop) &&
    !new URLSearchParams(window.location.search).has('platform') &&
    (window.indichatDesktop?.platform === 'darwin' || window.electronAPI?.platform === 'darwin' || (typeof navigator !== 'undefined' && /Macintosh|Mac OS X/i.test(navigator.userAgent)));

  const [isMinimized, setIsMinimized] = useState(false);
  const [showGnomeMenu, setShowGnomeMenu] = useState(false);

  const handleMinimize = () => {
    const desktop = window.indichatDesktop || window.electronAPI;
    if (desktop) {
      desktop.minimize();
    } else {
      setIsMinimized(true);
    }
  };

  const handleMaximize = () => {
    const desktop = window.indichatDesktop || window.electronAPI;
    if (desktop) {
      desktop.maximize();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const handleClose = () => {
    const desktop = window.indichatDesktop || window.electronAPI;
    if (desktop) {
      desktop.close();
    } else {
      setIsMinimized(true);
    }
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  return (
    <>
      {isMinimized && (
        <div
          id="restoreWindowPill"
          className="restore-window-pill"
          onClick={handleRestore}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 9999,
            background: 'var(--brand-emerald)',
            color: '#05080b',
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>💬 Restore IndiChat Window</span>
        </div>
      )}

      {platform === 'darwin' && (
        <div className="window-chrome chrome-macos" aria-label="macOS Native Title Bar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {isNativeMacElectron ? (
            /* On native macOS Electron, titleBarStyle: 'hiddenInset' renders the native WindowServer traffic lights.
               A 78px draggable spacer leaves that area clean and prevents duplicate custom buttons. */
            <div style={{ width: '78px', height: '100%', WebkitAppRegion: 'drag' } as React.CSSProperties} aria-hidden="true" />
          ) : (
            /* In browser preview emulation, render the HTML traffic light buttons */
            <div className="macos-traffic-lights" aria-label="Window control buttons" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                className="traffic-light close"
                title="Close window (Simulated - Tray)"
                aria-label="Close"
                onClick={handleClose}
              >
                <svg width="6" height="6" viewBox="0 0 6 6">
                  <path d="M1 1l4 4m0-4L1 5" stroke="#4c0000" strokeWidth="1.2" />
                </svg>
              </button>
              <button
                className="traffic-light minimize"
                title="Minimize window (Simulated - Dock)"
                aria-label="Minimize"
                onClick={handleMinimize}
              >
                <svg width="6" height="6" viewBox="0 0 6 6">
                  <path d="M1 3h4" stroke="#5a3d00" strokeWidth="1.2" />
                </svg>
              </button>
              <button
                className="traffic-light zoom"
                title="Zoom / Toggle Fullscreen (Simulated)"
                aria-label="Zoom"
                onClick={handleMaximize}
              >
                <svg width="6" height="6" viewBox="0 0 6 6">
                  <path d="M1 5l4-4M1 1h4v4" stroke="#003e00" strokeWidth="1.1" />
                </svg>
              </button>
            </div>
          )}

          <div className="macos-title">
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--brand-emerald)'
              }}
            />
            IndiChat — macOS Native Client
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <span className="platform-pill" style={{ fontSize: '10px' }}>
              Universal (Apple Silicon &amp; Intel)
            </span>
          </div>
        </div>
      )}

      {platform === 'web' && (
        <div className="window-chrome chrome-web" aria-label="Web Browser Chrome">
          <div className="browser-nav-btns" aria-hidden="true">
            <button className="icon-btn" style={{ width: '28px', height: '28px' }} title="Back" disabled>‹</button>
            <button className="icon-btn" style={{ width: '28px', height: '28px' }} title="Forward" disabled>›</button>
            <button className="icon-btn" style={{ width: '28px', height: '28px' }} title="Reload" onClick={() => window.location.reload()}>↻</button>
          </div>
          <div className="browser-address-bar">
            <span className="secure">🔒 https://</span><span>web.indichat.com</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6 }}>IndiChat Web v3.0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="platform-pill" style={{ fontSize: '10px' }}>Chrome / Edge / Safari</span>
          </div>
        </div>
      )}

      {platform === 'win32' && (
        <div className="window-chrome chrome-windows" aria-label="Windows Native Title Bar">
          <div className="windows-branding">
            <div className="windows-logo-mark" aria-hidden="true">
              i
            </div>
            <span>IndiChat — Windows 11 Desktop</span>
            <span className="platform-pill" style={{ fontSize: '10px', marginLeft: '8px' }}>
              x64 / ARM64
            </span>
          </div>

          <div className="windows-caption-controls" aria-label="Window control buttons">
            <button
              className="win-caption-btn win-min"
              title="Minimize"
              aria-label="Minimize"
              onClick={handleMinimize}
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <path d="M0 0h10v1H0z" fill="currentColor" />
              </svg>
            </button>
            <button
              className="win-caption-btn win-max"
              title="Maximize / Restore"
              aria-label="Maximize"
              onClick={handleMaximize}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M0 0h10v10H0V0zm1 1v8h8V1H1z" fill="currentColor" />
              </svg>
            </button>
            <button
              className="win-caption-btn win-close"
              title="Close to tray"
              aria-label="Close"
              onClick={handleClose}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {platform === 'linux' && (
        <div className="window-chrome chrome-linux" aria-label="Linux GNOME HeaderBar" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="gnome-pill-btn">
              <span style={{ fontWeight: 800, color: 'var(--brand-emerald)' }}>i</span>
              <span>IndiChat</span>
            </div>
            <span className="platform-pill" style={{ fontSize: '10px' }}>
              AppImage / Flatpak / deb
            </span>
          </div>

          <div className="gnome-title">
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--brand-emerald)'
              }}
            />
            IndiChat — GNOME Desktop
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} aria-label="Window control buttons">
            <button
              className="icon-btn"
              id="btnGnomeAppMenu"
              style={{ width: '28px', height: '28px' }}
              title="IndiChat Menu"
              aria-label="IndiChat menu"
              onClick={() => setShowGnomeMenu((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              className="gnome-close-btn"
              title="Close window"
              aria-label="Close window"
              onClick={handleClose}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M1 1l8 8m0-8L1 9" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>

          {showGnomeMenu && (
            <div className="gnome-app-dropdown" id="gnomeAppDropdownMenu">
              <button
                className="studio-btn"
                id="gnomeMenuSettings"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12.5px', padding: '8px 12px' }}
                onClick={() => {
                  setShowGnomeMenu(false);
                  onOpenSettings?.();
                }}
              >
                Preferences (Settings)
              </button>
              <button
                className="studio-btn"
                id="gnomeMenuShortcuts"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12.5px', padding: '8px 12px' }}
                onClick={() => {
                  setShowGnomeMenu(false);
                  onOpenShortcuts?.();
                }}
              >
                Keyboard Shortcuts
              </button>
              <button
                className="studio-btn"
                id="gnomeMenuHelp"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12.5px', padding: '8px 12px' }}
                onClick={() => {
                  setShowGnomeMenu(false);
                  onOpenHelp?.();
                }}
              >
                Help &amp; About
              </button>
              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
              <button
                className="studio-btn danger"
                id="gnomeMenuQuit"
                style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12.5px', padding: '8px 12px' }}
                onClick={() => {
                  setShowGnomeMenu(false);
                  handleClose();
                }}
              >
                Quit IndiChat
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

