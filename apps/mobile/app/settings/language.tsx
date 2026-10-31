/**
 * apps/mobile/app/settings/language.tsx
 *
 * Dedicated App Language Screen:
 *  - Reads supported languages from utils/i18n.ts
 *  - Updates settingsService and persists selection
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_LANGUAGES } from '../../utils/i18n';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function LanguageSettingsScreen() {
  const { palette, metrics, userSettings } = useTheme();

  const handleSelectLanguage = (code: string) => {
    settingsService.update({ language: code });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="App Language" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          SUPPORTED LANGUAGES
        </Text>
        <LiquidGlassSurface style={styles.card}>
          {SUPPORTED_LANGUAGES.map((lang, index) => {
            const active = userSettings.language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.row,
                  index < SUPPORTED_LANGUAGES.length - 1 && {
                    borderBottomColor: palette.divider,
                    borderBottomWidth: 1,
                  },
                ]}
                onPress={() => handleSelectLanguage(lang.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={lang.name}
              >
                <View style={styles.metaCol}>
                  <Text style={[styles.nativeName, { color: palette.textPrimary }]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={[styles.englishName, { color: palette.textSecondary }]}>
                    {lang.name}
                  </Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
              </TouchableOpacity>
            );
          })}
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
  card: { padding: 8, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metaCol: { flex: 1 },
  nativeName: { fontSize: 14, fontWeight: '600' },
  englishName: { fontSize: 11.5, marginTop: 2 },
});
