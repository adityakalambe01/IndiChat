/**
 * apps/mobile/app/settings/link-device.tsx
 *
 * Dedicated Link Device Screen:
 *  - Generates and presents ephemeral pairing code (matching existing mobile flow)
 *  - Copy code to clipboard with user feedback
 *  - Clear step-by-step instructions for Web and Desktop pairing
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function LinkDeviceScreen() {
  const { palette, metrics } = useTheme();

  // Generate ephemeral pairing code (e.g. ABCD-EFGH) matching existing implementation
  const [pairingCode, setPairingCode] = useState(() =>
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(pairingCode);
    Alert.alert('Copied', 'Pairing code copied to clipboard!');
  };

  const handleRegenerate = () => {
    const newCode =
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    setPairingCode(newCode);
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Link a Device" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.qrIconCircle}>
            <Ionicons name="qr-code-outline" size={36} color="#00a884" />
          </View>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Link with Code
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Enter this code on your IndiChat Desktop or Web browser to link your session.
          </Text>

          <View style={[styles.codeBox, { backgroundColor: palette.bgSecondary, borderColor: palette.glassBorder }]}>
            <Text style={[styles.codeText, { color: palette.textPrimary }]}>{pairingCode}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: palette.accent }]}
              onPress={handleCopyCode}
              accessibilityRole="button"
              accessibilityLabel="Copy pairing code"
            >
              <Ionicons name="copy-outline" size={18} color="#070b0e" style={{ marginRight: 6 }} />
              <Text style={styles.copyBtnText}>Copy Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.regenBtn, { borderColor: palette.glassBorder }]}
              onPress={handleRegenerate}
              accessibilityRole="button"
              accessibilityLabel="Generate new pairing code"
            >
              <Ionicons name="refresh-outline" size={18} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </LiquidGlassSurface>

        <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
          HOW TO LINK
        </Text>

        <LiquidGlassSurface style={styles.instructionsCard}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
                Open IndiChat on your computer
              </Text>
              <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
                Visit the web application or launch the native Linux desktop client.
              </Text>
            </View>
          </View>

          <View style={[styles.stepDivider, { backgroundColor: palette.glassBorder }]} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
                Navigate to Link Device
              </Text>
              <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
                Select Settings → Linked Devices → Enter Pairing Code.
              </Text>
            </View>
          </View>

          <View style={[styles.stepDivider, { backgroundColor: palette.glassBorder }]} />

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: palette.textPrimary }]}>
                Confirm the link
              </Text>
              <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
                Your session will synchronize contacts and chat history immediately.
              </Text>
            </View>
          </View>
        </LiquidGlassSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  qrIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 168, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  codeBox: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  copyBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#070b0e',
  },
  regenBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  instructionsCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 168, 132, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00a884',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepDivider: {
    height: 1,
    marginLeft: 42,
  },
});
