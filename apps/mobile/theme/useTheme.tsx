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
import { resolveEffectiveTheme, StagedAppearance } from './resolveTheme';
export type { StagedAppearance };

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
  const resolved = useMemo(() => {
    return resolveEffectiveTheme(
      settings,
      stagedPreview,
      systemScheme,
      systemReducedTransparency,
      systemReducedMotion
    );
  }, [settings, stagedPreview, systemScheme, systemReducedTransparency, systemReducedMotion]);

  const { effectiveBlurRadius, isDark, isSolid, isReducedMotion, blurIntensity, palette } = resolved;

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
