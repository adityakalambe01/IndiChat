/**
 * apps/mobile/components/FloatingDock.tsx
 *
 * Floating Liquid Glass Navigation Dock:
 *  - 64px height, 32px pill corner radius, floating position with safe area clearance
 *  - 5 core destinations: [ Updates | Calls | Circles | Chats (badge) | You ]
 *  - Outline icon family (disc-outline, call-outline, people-outline, chatbubble-outline)
 *  - 20x20 squircle/circle avatar for 'You'
 *  - Active tab capsule background (palette.dockActiveBg) and active text weight
 *  - Shared across both Chats and Settings Home (You)
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { PreviewIcon } from './PreviewIcon';
import { useTheme } from '../theme/useTheme';
import { FONTS } from '../theme/tokens';

export type DockTabType = 'updates' | 'calls' | 'communities' | 'chats' | 'you';

export interface FloatingDockProps {
  activeTab: DockTabType;
  unreadCount?: number;
  userInitial?: string;
  onTabPress?: (tab: DockTabType) => void;
}

export function FloatingDock({
  activeTab,
  unreadCount = 0,
  userInitial = 'Y',
  onTabPress,
}: FloatingDockProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();

  const handlePress = (tab: DockTabType) => {
    if (onTabPress) {
      onTabPress(tab);
      return;
    }

    if (tab === activeTab) return;

    if (tab === 'you') {
      router.navigate('/settings');
    } else {
      router.navigate({ pathname: '/chats', params: { tab } });
    }
  };

  return (
    <LiquidGlassSurface
      variant="chrome"
      style={[
        styles.floatingBottomDock,
        {
          bottom: Math.max(insets.bottom, 12) + 6,
          borderColor: palette.border,
        },
      ]}
    >
      {/* 1. Updates */}
      <TouchableOpacity
        style={[
          styles.dockTab,
          activeTab === 'updates' && { backgroundColor: palette.dockActiveBg },
        ]}
        onPress={() => handlePress('updates')}
        accessibilityRole="button"
        accessibilityLabel="Updates Tab"
      >
        <PreviewIcon
          name="updates"
          size={20}
          color={activeTab === 'updates' ? palette.dockActiveColor : palette.dockInactiveColor}
          strokeWidth={2}
        />
        <Text
          style={[
            styles.dockLabel,
            { color: activeTab === 'updates' ? palette.dockActiveColor : palette.dockInactiveColor },
            activeTab === 'updates' && styles.dockLabelActive,
          ]}
        >
          Updates
        </Text>
      </TouchableOpacity>

      {/* 2. Calls */}
      <TouchableOpacity
        style={[
          styles.dockTab,
          activeTab === 'calls' && { backgroundColor: palette.dockActiveBg },
        ]}
        onPress={() => handlePress('calls')}
        accessibilityRole="button"
        accessibilityLabel="Calls Tab"
      >
        <PreviewIcon
          name="calls"
          size={20}
          color={activeTab === 'calls' ? palette.dockActiveColor : palette.dockInactiveColor}
          strokeWidth={2}
        />
        <Text
          style={[
            styles.dockLabel,
            { color: activeTab === 'calls' ? palette.dockActiveColor : palette.dockInactiveColor },
            activeTab === 'calls' && styles.dockLabelActive,
          ]}
        >
          Calls
        </Text>
      </TouchableOpacity>

      {/* 3. Circles (Communities) */}
      <TouchableOpacity
        style={[
          styles.dockTab,
          activeTab === 'communities' && { backgroundColor: palette.dockActiveBg },
        ]}
        onPress={() => handlePress('communities')}
        accessibilityRole="button"
        accessibilityLabel="Circles Tab"
      >
        <PreviewIcon
          name="communities"
          size={20}
          color={activeTab === 'communities' ? palette.dockActiveColor : palette.dockInactiveColor}
          strokeWidth={2}
        />
        <Text
          style={[
            styles.dockLabel,
            { color: activeTab === 'communities' ? palette.dockActiveColor : palette.dockInactiveColor },
            activeTab === 'communities' && styles.dockLabelActive,
          ]}
        >
          Circles
        </Text>
      </TouchableOpacity>

      {/* 4. Chats */}
      <TouchableOpacity
        style={[
          styles.dockTab,
          activeTab === 'chats' && { backgroundColor: palette.dockActiveBg },
        ]}
        onPress={() => handlePress('chats')}
        accessibilityRole="button"
        accessibilityLabel={`Chats Tab ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <View style={{ position: 'relative' }}>
          <PreviewIcon
            name="chats"
            size={20}
            color={activeTab === 'chats' ? palette.dockActiveColor : palette.dockInactiveColor}
            strokeWidth={2}
          />
          {unreadCount > 0 && (
            <View style={styles.dockBadge}>
              <Text style={styles.dockBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.dockLabel,
            { color: activeTab === 'chats' ? palette.dockActiveColor : palette.dockInactiveColor },
            activeTab === 'chats' && styles.dockLabelActive,
          ]}
        >
          Chats
        </Text>
      </TouchableOpacity>

      {/* 5. You (Settings/Profile) */}
      <TouchableOpacity
        style={[
          styles.dockTab,
          activeTab === 'you' && { backgroundColor: palette.dockActiveBg },
        ]}
        onPress={() => handlePress('you')}
        accessibilityRole="button"
        accessibilityLabel="Settings and Profile"
      >
        <View style={[styles.youAvatar, { backgroundColor: '#10b981' }]}>
          <Text style={styles.youAvatarText}>{userInitial}</Text>
        </View>
        <Text
          style={[
            styles.dockLabel,
            { color: activeTab === 'you' ? palette.dockActiveColor : palette.dockInactiveColor },
            activeTab === 'you' && styles.dockLabelActive,
          ]}
        >
          You
        </Text>
      </TouchableOpacity>
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  floatingBottomDock: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  dockTab: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  dockLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    fontWeight: '500',
  },
  dockLabelActive: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  dockBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#10b981',
    height: 15,
    minWidth: 15,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBadgeText: {
    fontFamily: FONTS.bold,
    color: '#070b0e',
    fontSize: 9.5,
    fontWeight: '800',
  },
  youAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youAvatarText: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
