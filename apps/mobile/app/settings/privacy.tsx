/**
 * apps/mobile/app/settings/privacy.tsx
 *
 * Dedicated Privacy & Read Receipts Screen:
 *  - Last Seen & Online presence privacy options
 *  - Read Receipts toggle with preserved cyan checkmark (#53bdeb) explanation
 *  - Profile photo & link preview privacy controls
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
import { Ionicons } from '@expo/vector-icons';
import { settingsService, PrivacyOption } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function PrivacySettingsScreen() {
  const { palette, metrics, userSettings } = useTheme();

  const [lastSeen, setLastSeen] = useState<PrivacyOption>(userSettings.privacyLastSeen || 'everyone');
  const [readReceipts, setReadReceipts] = useState<boolean>(Boolean(userSettings.readReceipts));
  const [profilePhoto, setProfilePhoto] = useState<PrivacyOption>(userSettings.privacyProfilePhoto || 'everyone');

  const handleLastSeenChange = (opt: PrivacyOption) => {
    setLastSeen(opt);
    settingsService.update({ privacyLastSeen: opt });
  };

  const handleReadReceiptsToggle = (val: boolean) => {
    setReadReceipts(val);
    settingsService.update({ readReceipts: val });
  };

  const handleProfilePhotoChange = (opt: PrivacyOption) => {
    setProfilePhoto(opt);
    settingsService.update({ privacyProfilePhoto: opt });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Privacy" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        {/* Read Receipts Card */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          READ RECEIPTS & TICKS
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.metaCol}>
              <View style={styles.titleWithTick}>
                <Text style={[styles.switchTitle, { color: palette.textPrimary }]}>
                  Read Receipts
                </Text>
                <View style={[styles.tickBadge, { backgroundColor: palette.tickBacking }]}>
                  <Text style={[styles.cyanTickText, { color: palette.tickCyan || '#53bdeb' }]}>
                    ✓✓
                  </Text>
                </View>
              </View>
              <Text style={[styles.switchDesc, { color: palette.textSecondary }]}>
                Send and receive double cyan checkmarks (#53bdeb) when messages are read.
              </Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={handleReadReceiptsToggle}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10b981' }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel="Toggle Read Receipts"
            />
          </View>
          <Text style={[styles.hintFootnote, { color: palette.textSecondary }]}>
            If turned off, you won't send or receive read receipts. Read receipts are always
            sent for group conversations.
          </Text>
        </LiquidGlassSurface>

        {/* Last Seen Privacy */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          LAST SEEN & ONLINE
        </Text>
        <LiquidGlassSurface style={styles.card}>
          {(['everyone', 'contacts', 'nobody'] as PrivacyOption[]).map((opt, i, arr) => {
            const active = lastSeen === opt;
            const label = opt === 'everyone' ? 'Everyone' : opt === 'contacts' ? 'My Contacts' : 'Nobody';
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.optionRow,
                  i < arr.length - 1 && { borderBottomColor: palette.divider, borderBottomWidth: 1 },
                ]}
                onPress={() => handleLastSeenChange(opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <Text style={[styles.optionText, { color: palette.textPrimary }]}>{label}</Text>
                {active && <Ionicons name="checkmark" size={18} color="#10b981" />}
              </TouchableOpacity>
            );
          })}
        </LiquidGlassSurface>

        {/* Profile Photo Privacy */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          PROFILE PHOTO
        </Text>
        <LiquidGlassSurface style={styles.card}>
          {(['everyone', 'contacts', 'nobody'] as PrivacyOption[]).map((opt, i, arr) => {
            const active = profilePhoto === opt;
            const label = opt === 'everyone' ? 'Everyone' : opt === 'contacts' ? 'My Contacts' : 'Nobody';
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.optionRow,
                  i < arr.length - 1 && { borderBottomColor: palette.divider, borderBottomWidth: 1 },
                ]}
                onPress={() => handleProfilePhotoChange(opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
              >
                <Text style={[styles.optionText, { color: palette.textPrimary }]}>{label}</Text>
                {active && <Ionicons name="checkmark" size={18} color="#10b981" />}
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
  card: { padding: 14, marginBottom: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaCol: { flex: 1, paddingRight: 10 },
  titleWithTick: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  tickBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cyanTickText: {
    fontSize: 12,
    fontWeight: '800',
  },
  switchDesc: { fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  hintFootnote: { fontSize: 11, marginTop: 10, lineHeight: 15 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionText: { fontSize: 14, fontWeight: '500' },
});
