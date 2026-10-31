/**
 * apps/mobile/theme/useTheme.tsx
 *
 * Reactive Theme & Materials Engine:
 *  - Subscribes to settingsService for user preferences
 *  - Dynamically listens to OS ColorScheme (Daylight / Dark)
 *  - Dynamically listens to OS AccessibilityInfo (Reduce Motion, Reduce Transparency)
 *  - Provides live appearance preview staging for Settings -> Appearance & Materials
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  useColorScheme,
  Appearance,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { settingsService, MobileAppSettings, AppearanceModeOption, ReducedMotionOption } from '../services/settings';
import { PALETTE, METRICS } from './tokens';

export interface StagedAppearance {
  appearanceMode?: AppearanceModeOption;
  blurRadius?: number;
  reduceTransparency?: boolean;
  reducedMotion?: ReducedMotionOption;
}

export interface ThemeContextValue {
  isDark: boolean;
  palette: typeof PALETTE.dark;
  metrics: typeof METRICS;
  blurRadius: number; // 0 to 40
  blurIntensity: number; // 0 to 100 for expo-blur
  isSolid: boolean; // Solid opaque surfaces active
  isReducedMotion: boolean; // Animations silenced
  userSettings: MobileAppSettings;
  stagePreview: (staged: StagedAppearance | null) => void;
  saveStagedAppearance: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<MobileAppSettings>(settingsService.getSettings());
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [systemReducedTransparency, setSystemReducedTransparency] = useState(false);
  const [stagedPreview, setStagedPreview] = useState<StagedAppearance | null>(null);

  // 1. Subscribe to settingsService
  useEffect(() => {
    const unsub = settingsService.subscribe((s) => {
      setSettings(s);
    });
    return unsub;
  }, []);

  // 2. Listen to system accessibility preferences
  useEffect(() => {
    // Reduced motion
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReducedMotion).catch(() => {});
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion);

    // Reduced transparency (supported on iOS)
    let transparencySub: { remove: () => void } | null = null;
    if (Platform.OS === 'ios' && typeof (AccessibilityInfo as any).isReduceTransparencyEnabled === 'function') {
      (AccessibilityInfo as any).isReduceTransparencyEnabled().then(setSystemReducedTransparency).catch(() => {});
      try {
        transparencySub = AccessibilityInfo.addEventListener('reduceTransparencyChanged' as any, setSystemReducedTransparency);
      } catch (e) {
        // Ignored if event not available on platform
      }
    }

    return () => {
      motionSub?.remove?.();
      transparencySub?.remove?.();
    };
  }, []);

  // 3. Resolve effective properties (incorporating staged preview if active)
  const effectiveMode: AppearanceModeOption = stagedPreview?.appearanceMode ?? settings.appearanceMode ?? 'system';
  const effectiveBlurRadius: number = stagedPreview?.blurRadius ?? settings.blurRadius ?? 20;
  const effectiveReduceTransparency: boolean = stagedPreview?.reduceTransparency ?? settings.reduceTransparency ?? false;
  const effectiveReducedMotion: ReducedMotionOption = stagedPreview?.reducedMotion ?? settings.reducedMotion ?? 'system';

  // Effective isDark
  const isDark = useMemo(() => {
    if (effectiveMode === 'light') return false;
    if (effectiveMode === 'dark') return true;
    return systemScheme !== 'light';
  }, [effectiveMode, systemScheme]);

  // Effective isSolid (user switch OR system preference)
  const isSolid = useMemo(() => {
    return effectiveReduceTransparency || systemReducedTransparency;
  }, [effectiveReduceTransparency, systemReducedTransparency]);

  // Effective isReducedMotion (user switch OR system preference)
  const isReducedMotion = useMemo(() => {
    if (effectiveReducedMotion === 'on') return true;
    if (effectiveReducedMotion === 'off') return false;
    return systemReducedMotion;
  }, [effectiveReducedMotion, systemReducedMotion]);

  // Blur intensity: 0 if solid or blurRadius 0; otherwise mapped from 0-40 to 0-100
  const blurIntensity = useMemo(() => {
    if (isSolid) return 0;
    return Math.max(0, Math.min(100, Math.round((effectiveBlurRadius / 40) * 100)));
  }, [isSolid, effectiveBlurRadius]);

  const palette = isDark ? PALETTE.dark : PALETTE.light;

  const saveStagedAppearance = () => {
    if (!stagedPreview) return;
    settingsService.updateLocal({
      ...(stagedPreview.appearanceMode !== undefined && { appearanceMode: stagedPreview.appearanceMode }),
      ...(stagedPreview.blurRadius !== undefined && { blurRadius: stagedPreview.blurRadius }),
      ...(stagedPreview.reduceTransparency !== undefined && { reduceTransparency: stagedPreview.reduceTransparency }),
      ...(stagedPreview.reducedMotion !== undefined && { reducedMotion: stagedPreview.reducedMotion }),
    });
    setStagedPreview(null);
  };

  const value: ThemeContextValue = {
    isDark,
    palette,
    metrics: METRICS,
    blurRadius: effectiveBlurRadius,
    blurIntensity,
    isSolid,
    isReducedMotion,
    userSettings: settings,
    stagePreview: setStagedPreview,
    saveStagedAppearance,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if rendered outside ThemeProvider
    const isDark = Appearance.getColorScheme() !== 'light';
    return {
      isDark,
      palette: isDark ? PALETTE.dark : PALETTE.light,
      metrics: METRICS,
      blurRadius: 20,
      blurIntensity: 50,
      isSolid: false,
      isReducedMotion: false,
      userSettings: settingsService.getSettings(),
      stagePreview: () => {},
      saveStagedAppearance: () => {},
    };
  }
  return ctx;
}
