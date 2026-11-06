/**
 * apps/mobile/theme/resolveTheme.ts
 *
 * Core pure theme & materials resolution logic used across IndiChat mobile client.
 * Separates pure theme calculation from React component lifecycle.
 */

import { PALETTE, METRICS } from './tokens';
import type {
  MobileAppSettings,
  AppearanceModeOption,
  ReducedMotionOption,
} from '../services/settings';

export interface StagedAppearance {
  appearanceMode?: AppearanceModeOption;
  blurRadius?: number;
  reduceTransparency?: boolean;
  reducedMotion?: ReducedMotionOption;
}

export interface ResolvedTheme {
  effectiveMode: AppearanceModeOption;
  effectiveBlurRadius: number;
  effectiveReduceTransparency: boolean;
  effectiveReducedMotion: ReducedMotionOption;
  isDark: boolean;
  isSolid: boolean;
  isReducedMotion: boolean;
  blurIntensity: number;
  themeName: string;
  palette: typeof PALETTE.dark;
  metrics: typeof METRICS;
}

/**
 * Resolves effective appearance properties given stored settings, optional staged preview,
 * system colorScheme, and system accessibility preferences.
 *
 * Invariant: Explicit in-app appearanceMode ('light' | 'dark') takes strict precedence
 * over the operating system colorScheme. 'system' mode dynamically follows OS appearance.
 */
export function resolveEffectiveTheme(
  settings: Pick<MobileAppSettings, 'appearanceMode' | 'blurRadius' | 'reduceTransparency' | 'reducedMotion'>,
  stagedPreview?: StagedAppearance | null,
  systemScheme?: 'light' | 'dark' | null,
  systemReducedTransparency = false,
  systemReducedMotion = false
): ResolvedTheme {
  const effectiveMode: AppearanceModeOption = stagedPreview?.appearanceMode ?? settings.appearanceMode ?? 'system';
  const effectiveBlurRadius: number = stagedPreview?.blurRadius ?? settings.blurRadius ?? 20;
  const effectiveReduceTransparency: boolean = stagedPreview?.reduceTransparency ?? settings.reduceTransparency ?? false;
  const effectiveReducedMotion: ReducedMotionOption = stagedPreview?.reducedMotion ?? settings.reducedMotion ?? 'system';

  // Explicit in-app preference takes precedence over system OS appearance
  let isDark: boolean;
  if (effectiveMode === 'light') {
    isDark = false;
  } else if (effectiveMode === 'dark') {
    isDark = true;
  } else {
    isDark = systemScheme !== 'light';
  }

  const isSolid = effectiveReduceTransparency || systemReducedTransparency;
  const isReducedMotion = effectiveReducedMotion === 'on' ? true : effectiveReducedMotion === 'off' ? false : systemReducedMotion;
  const blurIntensity = isSolid ? 0 : Math.max(0, Math.min(100, Math.round((effectiveBlurRadius / 40) * 100)));
  const themeName = isDark ? 'Dark Obsidian' : 'Daylight Light';
  const palette = isDark ? PALETTE.dark : PALETTE.light;

  return {
    effectiveMode,
    effectiveBlurRadius,
    effectiveReduceTransparency,
    effectiveReducedMotion,
    isDark,
    isSolid,
    isReducedMotion,
    blurIntensity,
    themeName,
    palette,
    metrics: METRICS,
  };
}

