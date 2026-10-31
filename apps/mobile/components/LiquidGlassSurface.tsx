/**
 * apps/mobile/components/LiquidGlassSurface.tsx
 *
 * Multi-Platform Liquid Glass Surface Component:
 *  - Uses expo-blur <BlurView> for structural chrome (Headers, Dock, Modals)
 *  - Uses layered translucent styling + hairline highlights for Bento cards
 *  - Switches to solid opaque high-contrast surfaces when reduceTransparency / isSolid is active
 *  - Respects dynamic blur intensity (0 to 100) mapped from user-facing blur level (0 to 40)
 */

import React from 'react';
import { StyleSheet, View, ViewProps, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/useTheme';

export interface LiquidGlassSurfaceProps extends ViewProps {
  /**
   * 'card' (default): High-density translucent surface with fine border highlights
   * 'chrome': Structural persistent bar (Headers, Dock, Floating sheets) backed by native BlurView
   */
  variant?: 'card' | 'chrome';
  tintOverride?: 'dark' | 'light' | 'default';
  children?: React.ReactNode;
}

export function LiquidGlassSurface({
  variant = 'card',
  tintOverride,
  style,
  children,
  ...rest
}: LiquidGlassSurfaceProps) {
  const { isDark, palette, isSolid, blurIntensity } = useTheme();

  const tint = tintOverride || (isDark ? 'dark' : 'light');

  // Solid Surface Fallback (Reduce Transparency active or intensity is 0)
  if (isSolid || blurIntensity === 0) {
    return (
      <View
        style={[
          styles.base,
          {
            backgroundColor: palette.surface,
            borderColor: palette.borderStrong,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  // Structural Chrome (Header, Floating Dock, Sheets) uses native BlurView
  if (variant === 'chrome') {
    return (
      <BlurView
        intensity={blurIntensity}
        tint={tint}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
        style={[
          styles.base,
          {
            backgroundColor: isDark ? 'rgba(11, 16, 22, 0.45)' : 'rgba(242, 245, 243, 0.60)',
            borderColor: palette.border,
          },
          style,
        ]}
        {...rest}
      >
        {children}
      </BlurView>
    );
  }

  // Bento Card: High-density translucent surface with hairline highlights and soft shadow
  return (
    <View
      style={[
        styles.base,
        styles.cardShadow,
        {
          backgroundColor: isDark ? 'rgba(19, 28, 36, 0.78)' : 'rgba(255, 255, 255, 0.84)',
          borderColor: palette.border,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      } as any,
    }),
  },
});
