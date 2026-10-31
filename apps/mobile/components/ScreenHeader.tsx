/**
 * apps/mobile/components/ScreenHeader.tsx
 *
 * Screen Header Component (56px fixed height, sticky, Liquid Glass):
 *  - Enforces flexShrink: 0 to prevent collapsing
 *  - Back navigation with minimum 44x44 touch targets
 *  - Optional right action (text button or icon button)
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { useTheme } from '../theme/useTheme';

export interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightActionText?: string;
  onRightAction?: () => void;
  rightActionLoading?: boolean;
  rightActionDisabled?: boolean;
  rightIconName?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  rightIconLabel?: string;
}

export function ScreenHeader({
  title,
  showBack = true,
  onBack,
  rightActionText,
  onRightAction,
  rightActionLoading = false,
  rightActionDisabled = false,
  rightIconName,
  onRightIconPress,
  rightIconLabel,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <LiquidGlassSurface
      variant="chrome"
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          height: 56 + insets.top,
          minHeight: 56 + insets.top,
          maxHeight: 56 + insets.top,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View style={styles.leftRow}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
            </TouchableOpacity>
          )}
          <Text
            style={[styles.title, { color: palette.textPrimary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>

        <View style={styles.rightRow}>
          {rightActionText && (
            <TouchableOpacity
              onPress={onRightAction}
              disabled={rightActionDisabled || rightActionLoading}
              accessibilityRole="button"
              accessibilityLabel={rightActionText}
              accessibilityState={{ disabled: rightActionDisabled || rightActionLoading }}
              style={[
                styles.actionTextButton,
                (rightActionDisabled || rightActionLoading) && styles.actionDisabled,
              ]}
            >
              {rightActionLoading ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <Text style={styles.actionText}>{rightActionText}</Text>
              )}
            </TouchableOpacity>
          )}

          {rightIconName && (
            <TouchableOpacity
              onPress={onRightIconPress}
              accessibilityRole="button"
              accessibilityLabel={rightIconLabel || 'Action'}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.iconButton}
            >
              <Ionicons name={rightIconName} size={22} color={palette.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    minHeight: 56,
    maxHeight: 56,
    borderRadius: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    flexShrink: 0,
    width: '100%',
    zIndex: 10,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
    minWidth: 0,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  actionTextButton: {
    minHeight: 36,
    minWidth: 54,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
