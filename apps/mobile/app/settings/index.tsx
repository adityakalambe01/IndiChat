/**
 * apps/mobile/app/settings/index.tsx
 *
 * Settings Home ("You"):
 *  - Aligned strictly with preview/preview-liquid-glass.html -> You
 *  - Sticky Liquid Glass page header with "You" title and functional search action
 *  - Profile Hero card with 54x54 (18px radius) squircle avatar, name, handle, phone, and emerald bio
 *  - Bento sections: "Account & Security", "Chat & Appearance", "System & Session"
 *  - Consistent outlined icon family with Emerald (rgba(16,185,129,0.12)) and Cyan (rgba(6,182,212,0.12)) badges
 *  - Shared FloatingDock retaining bottom navigation with 'You' active
 *  - Full vertical scrollability with bottom clearance above the floating dock
 *  - Real data preserved (user profile, device count, language, appearance mode, storage)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Conversation } from '@chat/shared-types';
import { storage, STORAGE_KEYS } from '../../services/storage';
import { api } from '../../services/api';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { AmbientCanvas } from '../../components/AmbientCanvas';
import { FloatingDock } from '../../components/FloatingDock';
import { CompactSearchField } from '../../components/CompactSearchField';
import { PreviewIcon, PreviewIconName } from '../../components/PreviewIcon';
import { BlurTargetView } from 'expo-blur';
import { BlurTargetProvider } from '../../theme/BlurTargetContext';
import { FONTS } from '../../theme/tokens';
import Constants from 'expo-constants';

interface SettingsMenuItem {
  id: string;
  title: string;
  desc: string;
  route: string;
  icon: PreviewIconName;
  badgeType: 'emerald' | 'cyan' | 'danger';
  value?: string;
  category: string;
}

export default function SettingsHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    scroll?: string;
    scrollY?: string;
    search?: string;
    theme?: string;
    blur?: string;
    solid?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { palette, userSettings } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<any>(null);
  const blurTargetRef = useRef<any>(null);

  const applySettingsParams = (p: {
    scroll?: string;
    scrollY?: string;
    search?: string;
    theme?: string;
    blur?: string;
    solid?: string;
  }) => {
    if (p.theme === 'light' || p.theme === 'dark' || p.theme === 'system') {
      settingsService.update({ appearanceMode: p.theme as any });
    }
    if (p.blur !== undefined) {
      settingsService.updateLocal({ blurRadius: Math.max(0, Math.min(40, Number(p.blur))) });
    }
    if (p.solid !== undefined) {
      settingsService.updateLocal({ reduceTransparency: p.solid === 'true' || p.solid === '1' });
    }
    if (p.scrollY !== undefined) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: Number(p.scrollY), animated: false });
      }, 300);
    } else if (p.scroll === 'bottom') {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 300);
    } else if (p.scroll === 'top') {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 300);
    }
    if (p.search === 'true' || p.search === '1') {
      setIsSearchActive(true);
    } else if (p.search === 'false' || p.search === '0') {
      setIsSearchActive(false);
    }
  };

  useEffect(() => {
    applySettingsParams(params);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      try {
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const queryString = url.slice(queryIndex + 1);
          const pairs = queryString.split('&');
          const parsedParams: Record<string, string> = {};
          for (const pair of pairs) {
            const [k, v] = pair.split('=');
            if (k) parsedParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
          }
          applySettingsParams(parsedParams);
        }
      } catch (e) {
        console.warn('Failed to parse incoming URL:', e);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [params.scroll, params.scrollY, params.search, params.theme, params.blur, params.solid]);

  useEffect(() => {
    (async () => {
      // 1. Load user data
      const u = await storage.getJson<User>(STORAGE_KEYS.CURRENT_USER);
      if (u) setCurrentUser(u);

      // 2. Load conversations to compute dock unread count
      try {
        const convs = await api.getConversations();
        if (convs && Array.isArray(convs)) {
          const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
          setUnreadCount(totalUnread);
        }
      } catch {
        // Fallback to 0 if offline
      }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to end your session on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAuth();
            settingsService.resetForLogout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const displayName = currentUser?.displayName || userSettings.displayName || 'User';
  const username = currentUser?.username || userSettings.username || 'user';
  const phoneNumber = userSettings.phoneNumber || currentUser?.phoneNumber || '+91 98765 43210';
  const statusAbout = userSettings.statusAbout || 'Available on IndiChat ✨';
  const initial = (displayName.charAt(0) || 'U').toUpperCase();

  const appearanceLabel =
    userSettings.appearanceMode === 'dark'
      ? 'Dark Obsidian'
      : userSettings.appearanceMode === 'light'
      ? 'Daylight'
      : 'System';

  const languageLabel =
    userSettings.language === 'en'
      ? 'English'
      : userSettings.language === 'hi'
      ? 'हिन्दी'
      : userSettings.language === 'mr'
      ? 'मराठी'
      : userSettings.language.toUpperCase();

  // Settings catalog for both Bento rendering and functional search
  const allSettingsItems: SettingsMenuItem[] = useMemo(() => [
    // Account & Security
    {
      id: 'account',
      title: 'Account & Login',
      desc: 'Password, 2-Step verification, Passkeys',
      route: '/settings/account',
      icon: 'shield',
      badgeType: 'emerald',
      category: 'Account & Security',
    },
    {
      id: 'privacy',
      title: 'Privacy & Read Receipts',
      desc: 'Last seen, cyan checkmarks, disappearing chats',
      route: '/settings/privacy',
      icon: 'lock',
      badgeType: 'cyan',
      category: 'Account & Security',
    },
    {
      id: 'devices',
      title: 'Linked Devices',
      desc: 'Web & Desktop active sessions',
      route: '/settings/linked-devices',
      icon: 'device',
      badgeType: 'emerald',
      value: `${userSettings.linkedDevices?.length || 0} active`,
      category: 'Account & Security',
    },

    // Chat & Appearance
    {
      id: 'appearance',
      title: 'Appearance & Materials',
      desc: 'Liquid glass, theme, blur, reduced motion',
      route: '/settings/appearance',
      icon: 'palette',
      badgeType: 'cyan',
      value: appearanceLabel,
      category: 'Chat & Appearance',
    },
    {
      id: 'chats',
      title: 'Chats & Wallpaper',
      desc: 'Theme, media visibility, backup',
      route: '/settings/chats',
      icon: 'palette',
      badgeType: 'emerald',
      category: 'Chat & Appearance',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      desc: 'Message tones, vibration, priority alerts',
      route: '/settings/notifications',
      icon: 'bell',
      badgeType: 'cyan',
      category: 'Chat & Appearance',
    },
    {
      id: 'language',
      title: 'App Language',
      desc: 'English, हिन्दी, मराठी, ગુજરાતી...',
      route: '/settings/language',
      icon: 'globe',
      badgeType: 'emerald',
      value: languageLabel,
      category: 'Chat & Appearance',
    },
    {
      id: 'storage',
      title: 'Storage & Data',
      desc: 'Network counters, cache clearance',
      route: '/settings/storage',
      icon: 'storage',
      badgeType: 'cyan',
      category: 'Chat & Appearance',
    },

    // System & Session
    {
      id: 'server',
      title: 'Backend Server Settings',
      desc: 'Configure API host URL & diagnostics',
      route: '/settings/server',
      icon: 'cloud',
      badgeType: 'emerald',
      category: 'System & Session',
    },
    {
      id: 'help',
      title: 'Help & Support',
      desc: 'FAQ, licenses, app info',
      route: '/settings/help',
      icon: 'help',
      badgeType: 'cyan',
      category: 'System & Session',
    },
    {
      id: 'logout',
      title: 'Log Out',
      desc: 'End session on this device',
      route: '__logout__',
      icon: 'trash',
      badgeType: 'danger',
      category: 'System & Session',
    },
  ], [userSettings, appearanceLabel, languageLabel]);

  // Filtered items when search is active
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allSettingsItems;
    const query = searchQuery.toLowerCase().trim();
    return allSettingsItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [allSettingsItems, searchQuery]);

  const renderBadge = (badgeType: 'emerald' | 'cyan' | 'danger', icon: PreviewIconName) => {
    let bg = 'rgba(16, 185, 129, 0.12)';
    let color = '#10b981';

    if (badgeType === 'cyan') {
      bg = 'rgba(6, 182, 212, 0.12)';
      color = '#06b6d4';
    } else if (badgeType === 'danger') {
      bg = 'rgba(244, 63, 94, 0.12)';
      color = '#f43f5e';
    }

    return (
      <View style={[styles.menuRowIcon, { backgroundColor: bg }]}>
        <PreviewIcon name={icon} size={17} color={color} strokeWidth={2} />
      </View>
    );
  };

  const renderMenuRow = (item: SettingsMenuItem, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.menuRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border },
      ]}
      onPress={() => {
        if (item.route === '__logout__') {
          handleLogout();
        } else {
          router.push(item.route as any);
        }
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {renderBadge(item.badgeType, item.icon)}
      <View style={styles.menuRowContent}>
        <Text
          style={[
            styles.menuRowTitle,
            { color: item.badgeType === 'danger' ? '#f43f5e' : palette.textPrimary },
          ]}
        >
          {item.title}
        </Text>
        <Text style={[styles.menuRowDesc, { color: palette.textSecondary }]}>
          {item.desc}
        </Text>
      </View>
      {item.value ? (
        <Text style={[styles.menuRowValue, { color: palette.textSecondary }]}>
          {item.value}
        </Text>
      ) : null}
      <Text style={[styles.chevronGlyph, { color: palette.textSecondary }]}>›</Text>
    </TouchableOpacity>
  );

  return (
    <BlurTargetProvider value={blurTargetRef}>
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
          <AmbientCanvas />

          {/* Main Vertically Scrollable Content */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: 56 + insets.top + (isSearchActive ? 56 : 0) + 12,
                paddingBottom: Math.max(insets.bottom, 12) + 120,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
        {isSearchActive ? (
          /* Search Results View */
          <View style={styles.searchResultsWrapper}>
            <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>
              {searchQuery.trim()
                ? `Results (${filteredItems.length})`
                : 'All Settings'}
            </Text>
            {filteredItems.length > 0 ? (
              <LiquidGlassSurface variant="card" style={styles.bentoCard}>
                {filteredItems.map((item, idx) =>
                  renderMenuRow(item, idx === filteredItems.length - 1)
                )}
              </LiquidGlassSurface>
            ) : (
              <View style={styles.emptySearchCard}>
                <View style={{ opacity: 0.4, marginBottom: 8 }}>
                  <PreviewIcon name="search" size={32} color={palette.textSecondary} strokeWidth={1.5} />
                </View>
                <Text style={[styles.emptySearchTitle, { color: palette.textPrimary }]}>
                  No settings match "{searchQuery}"
                </Text>
                <Text style={[styles.emptySearchSub, { color: palette.textSecondary }]}>
                  Try searching for account, privacy, appearance, notifications, or devices.
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Normal Bento Layout matching preview/preview-liquid-glass.html -> viewSettingsHome() */
          <>
            {/* Profile Card with Edit shortcut */}
            <LiquidGlassSurface variant="card" style={styles.profileCard}>
              <TouchableOpacity
                style={styles.profileRow}
                onPress={() => router.push('/settings/profile')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit Profile"
              >
                {/* 54x54 squircle avatar with 18px radius */}
                <View style={styles.avatarSquircle}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>

                {/* Profile metadata */}
                <View style={styles.profileMeta}>
                  <Text style={[styles.profileDisplayName, { color: palette.textPrimary }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={[styles.profileHandlePhone, { color: palette.textSecondary }]} numberOfLines={1}>
                    @{username} · {phoneNumber}
                  </Text>
                  <Text style={styles.profileStatusBio} numberOfLines={1}>
                    {statusAbout}
                  </Text>
                </View>

                {/* Chevron */}
                <Text style={[styles.profileChevron, { color: palette.textSecondary }]}>›</Text>
              </TouchableOpacity>
            </LiquidGlassSurface>

            {/* Section 1: Account & Security */}
            <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>
              Account & Security
            </Text>
            <LiquidGlassSurface variant="card" style={styles.bentoCard}>
              {allSettingsItems
                .filter((item) => item.category === 'Account & Security')
                .map((item, idx, arr) => renderMenuRow(item, idx === arr.length - 1))}
            </LiquidGlassSurface>

            {/* Section 2: Chat & Appearance */}
            <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>
              Chat & Appearance
            </Text>
            <LiquidGlassSurface variant="card" style={styles.bentoCard}>
              {allSettingsItems
                .filter((item) => item.category === 'Chat & Appearance')
                .map((item, idx, arr) => renderMenuRow(item, idx === arr.length - 1))}
            </LiquidGlassSurface>

            {/* Section 3: System & Session */}
            <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>
              System & Session
            </Text>
            <LiquidGlassSurface variant="card" style={styles.bentoCard}>
              {allSettingsItems
                .filter((item) => item.category === 'System & Session')
                .map((item, idx, arr) => renderMenuRow(item, idx === arr.length - 1))}
            </LiquidGlassSurface>

            {/* Version & Architecture Footer */}
            <View style={styles.footerWrap}>
              <Text style={[styles.footerText, { color: palette.textSecondary }]}>
                IndiChat v{Constants.expoConfig?.version || '1.4.0'} · WhatsApp-class Security & Architecture
              </Text>
            </View>
          </>
        )}
          </ScrollView>
        </BlurTargetView>

        {/* Sticky Liquid Glass Page Header */}
        <LiquidGlassSurface
          variant="chrome"
          style={[
            styles.pageHeader,
            {
              paddingTop: insets.top,
              height: 56 + insets.top,
              borderBottomColor: palette.border,
            },
          ]}
        >
          <View style={styles.pageHeaderLeft}>
            <Text style={[styles.pageHeaderTitle, { color: palette.textPrimary }]}>
              You
            </Text>
          </View>

          <View style={styles.pageHeaderRight}>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                isSearchActive && { backgroundColor: 'rgba(255, 255, 255, 0.10)' },
              ]}
              onPress={() => {
                if (isSearchActive) {
                  setIsSearchActive(false);
                  setSearchQuery('');
                } else {
                  setIsSearchActive(true);
                  setTimeout(() => (searchInputRef.current as any)?.focus(), 100);
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isSearchActive ? 'Close search' : 'Search settings'}
            >
              <PreviewIcon
                name={isSearchActive ? 'close' : 'search'}
                size={19}
                color={palette.textSecondary}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
        </LiquidGlassSurface>

        {/* Search Input Bar when Search is Active */}
        {isSearchActive && (
          <View
            style={[
              styles.searchBarWrapper,
              {
                top: 56 + insets.top,
                borderBottomColor: palette.border,
                backgroundColor: palette.surfaceHeader,
              },
            ]}
          >
            <CompactSearchField
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search settings..."
            />
          </View>
        )}

        {/* Floating Bottom Navigation Dock with 'You' Active */}
        <FloatingDock
          activeTab="you"
          unreadCount={unreadCount}
          userInitial={initial}
        />
      </View>
    </BlurTargetProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  pageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
  },
  profileCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarSquircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  profileDisplayName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  profileHandlePhone: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  profileStatusBio: {
    fontFamily: FONTS.medium,
    fontSize: 11.5,
    color: '#10b981',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 15,
  },
  profileChevron: {
    fontSize: 18,
    opacity: 0.5,
    marginLeft: 4,
  },
  bentoSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
  },
  bentoCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 59,
  },
  menuRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuRowContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  menuRowTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  menuRowDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  menuRowValue: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    marginRight: 4,
    fontWeight: '500',
    lineHeight: 15,
  },
  chevronGlyph: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    opacity: 0.5,
  },
  footerWrap: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.regular,
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16,
  },
  searchResultsWrapper: {
    paddingTop: 4,
  },
  emptySearchCard: {
    marginHorizontal: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySearchSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
