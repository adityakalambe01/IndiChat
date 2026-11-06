/**
 * apps/mobile/components/InAppSwitch.tsx
 *
 * In-app switch component matching preview .glass-switch:
 * - 44x24 track with 12px border radius
 * - 18x18 smooth circular thumb
 * - Brand emerald (#10b981) active fill
 * - Translucent glass track when inactive
 * - Cross-platform pixel-identical rendering on both iOS and Android
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewProps,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface InAppSwitchProps extends ViewProps {
  value: boolean;
  onValueChange?: (val: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function InAppSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = 'Switch toggle',
  style,
}: InAppSwitchProps) {
  const { isDark, isReducedMotion, palette } = useTheme();
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (isReducedMotion) {
      animValue.setValue(value ? 1 : 0);
    } else {
      Animated.timing(animValue, {
        toValue: value ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
  }, [value, isReducedMotion]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
      '#10b981',
    ],
  });

  const borderColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [
      palette.border,
      '#10b981',
    ],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.touchTarget, style]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor,
            borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2.5,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      } as any,
    }),
  },
});
