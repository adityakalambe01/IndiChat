/**
 * apps/mobile/app/settings/chats.tsx
 *
 * Dedicated Chat Settings Screen:
 *  - Enter is Send & Media Visibility toggles
 *  - Font size selector
 *  - Links to Wallpaper and dedicated Chat Backup screens
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { settingsService, FontSizeOption } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function ChatsSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  const [enterIsSend, setEnterIsSend] = useState(Boolean(userSettings.enterIsSend));
  const [mediaVisibility, setMediaVisibility] = useState(Boolean(userSettings.mediaVisibility));
  const [fontSize, setFontSize] = useState<FontSizeOption>(userSettings.fontSize || 'medium');

  const handleEnterToggle = (val: boolean) => {
    setEnterIsSend(val);
    settingsService.update({ enterIsSend: val });
  };

  const handleMediaToggle = (val: boolean) => {
    setMediaVisibility(val);
    settingsService.update({ mediaVisibility: val });
  };

  const handleFontChange = (val: FontSizeOption) => {
    setFontSize(val);
    settingsService.update({ fontSize: val });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Chats" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          DISPLAY & INPUT
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.switchRow, { borderBottomColor: palette.divider }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Enter is Send</Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Pressing Enter key on keyboard sends message immediately
              </Text>
            </View>
            <Switch
              value={enterIsSend}
              onValueChange={handleEnterToggle}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Media Visibility</Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Show newly downloaded media in device gallery
              </Text>
            </View>
            <Switch
              value={mediaVisibility}
              onValueChange={handleMediaToggle}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>
        </LiquidGlassSurface>

        {/* Font Size Selector */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          FONT SIZE
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <View style={styles.segmentedRow}>
            {(['small', 'medium', 'large'] as FontSizeOption[]).map((opt) => {
              const active = fontSize === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.segmentBtn,
                    active && { backgroundColor: palette.surfaceElevated, borderColor: palette.borderStrong },
                  ]}
                  onPress={() => handleFontChange(opt)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? palette.textPrimary : palette.textSecondary },
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {opt.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LiquidGlassSurface>

        {/* Navigation to Wallpaper & Backup */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          CUSTOMIZATION & ARCHIVE
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <TouchableOpacity
            style={[styles.navRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/wallpaper')}
            accessibilityRole="button"
            accessibilityLabel="Chat Wallpaper"
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
              <Ionicons name="image" size={18} color="#06b6d4" />
            </View>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Wallpaper</Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Customize conversation room background
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/settings/backup')}
            accessibilityRole="button"
            accessibilityLabel="Chat Backup"
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="cloud-upload" size={18} color="#10b981" />
            </View>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Chat Backup</Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Local database archive & encryption
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 8,
  },
  card: { padding: 14, marginBottom: 16 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCol: { flex: 1, paddingRight: 8 },
  title: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 11.5, marginTop: 2 },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  segmentText: { fontSize: 12, fontWeight: '600' },
  segmentTextActive: { fontWeight: '700' },
});
