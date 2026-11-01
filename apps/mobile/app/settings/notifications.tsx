/**
 * apps/mobile/app/settings/notifications.tsx
 *
 * Dedicated Notifications Settings Screen:
 *  - Controls alert tones, vibration, priority banners
 *  - System push notification status check
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { InAppSwitch } from '../../components/InAppSwitch';
import { FONTS } from '../../theme/tokens';

export default function NotificationsSettingsScreen() {
  const { palette, metrics } = useTheme();

  const [messageAlerts, setMessageAlerts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Notifications" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          MESSAGES & ALERTS
        </Text>
        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Conversation Alerts
              </Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Show incoming message notifications
              </Text>
            </View>
            <InAppSwitch
              value={messageAlerts}
              onValueChange={setMessageAlerts}
              accessibilityLabel="Conversation Alerts"
            />
          </View>

          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Sound Effects
              </Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Play ringtone & message chime
              </Text>
            </View>
            <InAppSwitch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              accessibilityLabel="Sound Effects"
            />
          </View>

          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Vibration
              </Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Vibrate device on incoming alerts
              </Text>
            </View>
            <InAppSwitch
              value={vibrateEnabled}
              onValueChange={setVibrateEnabled}
              accessibilityLabel="Vibration"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.metaCol}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                Message Previews
              </Text>
              <Text style={[styles.desc, { color: palette.textSecondary }]}>
                Show sender name and message text in banner
              </Text>
            </View>
            <InAppSwitch
              value={previewEnabled}
              onValueChange={setPreviewEnabled}
              accessibilityLabel="Message Previews"
            />
          </View>
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
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 8,
  },
  card: { padding: 14, marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  metaCol: { flex: 1, paddingRight: 8 },
  title: { fontFamily: FONTS.semiBold, fontSize: 14, fontWeight: '600' },
  desc: { fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 2 },
});
