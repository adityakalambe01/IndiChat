import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

/**
 * AmbientCanvas:
 * Renders the preview's subtle restrained ambient canvas with depth:
 * - Linear gradient from --phone-bg (#070b0e) to --phone-surface (#0e141a)
 * - Subtle emerald radial glow at top-left (15% 10%)
 * - Subtle cyan radial glow at bottom-right (85% 85%)
 * - Falls back to solid background when reduceTransparency / isSolid is active
 */
export function AmbientCanvas() {
  const { isDark, isSolid } = useTheme();

  if (isSolid) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? '#070b0e' : '#f2f5f3' },
        ]}
        pointerEvents="none"
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="ambientBgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={isDark ? '#070b0e' : '#f2f5f3'} />
            <Stop offset="100%" stopColor={isDark ? '#0e141a' : '#ffffff'} />
          </LinearGradient>
          <RadialGradient id="ambientEmeraldRadial" cx="15%" cy="10%" rx="40%" ry="40%" fx="15%" fy="10%">
            <Stop offset="0%" stopColor="#10b981" stopOpacity={isDark ? '0.07' : '0.05'} />
            <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ambientCyanRadial" cx="85%" cy="85%" rx="45%" ry="45%" fx="85%" fy="85%">
            <Stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? '0.06' : '0.04'} />
            <Stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ambientBgGrad)" />
        <Rect width="100%" height="100%" fill="url(#ambientEmeraldRadial)" />
        <Rect width="100%" height="100%" fill="url(#ambientCyanRadial)" />
      </Svg>
    </View>
  );
}
