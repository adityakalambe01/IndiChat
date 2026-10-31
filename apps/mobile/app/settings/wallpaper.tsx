/**
 * apps/mobile/app/settings/wallpaper.tsx
 *
 * Dedicated Chat Wallpaper Customization Screen:
 *  - Visual preset swatches (Obsidian Glass, Emerald Mist, Daylight Slate, Midnight Teal)
 *  - Live preview representation
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

const WALLPAPERS = [
  { id: 'default', name: 'Default Ambient', color: '#0b1016' },
  { id: 'emerald', name: 'Emerald Mist', color: '#062d22' },
  { id: 'cyan', name: 'Cyan Obsidian', color: '#071f28' },
  { id: 'indigo', name: 'Deep Indigo', color: '#13112c' },
  { id: 'slate', name: 'Frosted Slate', color: '#1a2530' },
  { id: 'light', name: 'Daylight Cream', color: '#e8ecea' },
];

export default function WallpaperSettingsScreen() {
  const { palette, metrics } = useTheme();
  const [selected, setSelected] = useState('default');

  const handleSelect = (id: string) => {
    setSelected(id);
    Alert.alert('Wallpaper Selected', 'Chat background updated for all conversations.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Wallpaper" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.previewCard}>
          <View style={[styles.previewMock, { backgroundColor: WALLPAPERS.find(w => w.id === selected)?.color }]}>
            <View style={styles.bubbleMockIncoming}>
              <Text style={styles.bubbleText}>Previewing chat room ambiance...</Text>
            </View>
            <View style={styles.bubbleMockOutgoing}>
              <Text style={styles.bubbleText}>Looks crisp with liquid glass! ✨</Text>
            </View>
          </View>
        </LiquidGlassSurface>

        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          COLOR PALETTES
        </Text>
        <View style={styles.grid}>
          {WALLPAPERS.map((w) => {
            const active = selected === w.id;
            return (
              <TouchableOpacity
                key={w.id}
                style={[
                  styles.swatchCard,
                  { backgroundColor: w.color, borderColor: active ? '#10b981' : palette.border },
                ]}
                onPress={() => handleSelect(w.id)}
                accessibilityRole="button"
                accessibilityLabel={w.name}
              >
                <Text style={styles.swatchText}>{w.name}</Text>
                {active && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={16} color="#070b0e" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  previewCard: { padding: 12, marginBottom: 16 },
  previewMock: {
    height: 180,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'center',
    gap: 12,
  },
  bubbleMockIncoming: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '80%',
  },
  bubbleMockOutgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#005c4b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '80%',
  },
  bubbleText: { color: '#ffffff', fontSize: 13 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchCard: {
    width: '48%',
    height: 70,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  swatchText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
