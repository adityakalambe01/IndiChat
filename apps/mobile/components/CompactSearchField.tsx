/**
 * apps/mobile/components/CompactSearchField.tsx
 *
 * Compact Search Bar Component (44px height, 18px SVG icon):
 *  - Enforces explicit height and flexShrink: 0
 *  - Prevents flex stretching or collapsing across all screens
 *  - Integrates with LiquidGlass design tokens
 */

import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  TextInputProps,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export interface CompactSearchFieldProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const CompactSearchField = React.forwardRef<TextInput, CompactSearchFieldProps>(
  function CompactSearchField(
    {
      value,
      onChangeText,
      placeholder = 'Search conversations...',
      onClear,
      style,
      ...rest
    },
    ref
  ) {
    const { palette } = useTheme();

    return (
      <View style={styles.wrapper}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: palette.surfaceInput,
              borderColor: palette.border,
            },
            style,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={palette.textSecondary}
            style={styles.icon}
          />
          <TextInput
            ref={ref as any}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={palette.textSecondary}
            style={[styles.input, { color: palette.textPrimary }]}
            returnKeyType="search"
            accessibilityRole="search"
            accessibilityLabel={placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            {...rest}
          />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              onClear?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={16} color={palette.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexShrink: 0,
    width: '100%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    minHeight: 44,
    maxHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexShrink: 0,
    width: '100%',
  },
  icon: {
    width: 18,
    height: 18,
    marginRight: 10,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 13.5,
    fontWeight: '400',
    letterSpacing: 0,
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  clearBtn: {
    padding: 2,
    marginLeft: 6,
    flexShrink: 0,
  },
});
