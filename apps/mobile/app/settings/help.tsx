/**
 * apps/mobile/app/settings/help.tsx
 *
 * Dedicated Help & About Screen:
 *  - Displays genuine app version from Constants.expoConfig
 *  - FAQs regarding IndiChat architecture, receipts, and data storage
 *  - Contact Support and Terms
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What do the delivery tick marks mean?',
    a: 'Single grey check (✓) indicates your message reached the server. Double grey checks (✓✓) mean the message was delivered to the recipient\'s device. Double cyan checks (✓✓) confirm the recipient opened and read the message.',
  },
  {
    q: 'How does multi-device synchronization work?',
    a: 'IndiChat maintains independent sessions across Android, iOS, Web, and Linux Desktop. You do not need to keep your phone online to message from your computer.',
  },
  {
    q: 'Where are my chat backups stored?',
    a: 'IndiChat preserves your conversations in secure local encrypted storage on your device. Exported backup archives are written to your local device file system.',
  },
  {
    q: 'Can I connect to a custom backend server?',
    a: 'Yes. In Settings → Server Connection, you can configure your own Spring Boot backend endpoint (e.g. your local LAN IP for self-hosted instances).',
  },
];

export default function HelpSettingsScreen() {
  const { palette, metrics } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const sdkVersion = Constants.expoConfig?.sdkVersion || '52.0.0';

  const handleContactSupport = () => {
    Alert.alert(
      'IndiChat Support',
      'For issues, bug reports, and feedback, please visit our open-source repository or contact support@indichat.app.',
      [{ text: 'OK' }]
    );
  };

  const handleViewLicenses = () => {
    Alert.alert(
      'Open Source Licenses',
      'IndiChat is powered by React Native, Expo, Spring Boot, PostgreSQL, Redis, and MinIO S3 Object Storage.',
      [{ text: 'Close' }]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Help & About" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.brandingCard}>
          <View style={styles.appLogoCircle}>
            <Ionicons name="chatbubbles" size={36} color="#00a884" />
          </View>
          <Text style={[styles.appName, { color: palette.textPrimary }]}>IndiChat</Text>
          <Text style={[styles.appVersion, { color: palette.textSecondary }]}>
            Version {appVersion} (SDK {sdkVersion}) • {Platform.OS}
          </Text>
          <Text style={[styles.appTagline, { color: palette.textSecondary }]}>
            High-performance, multi-platform real-time messaging
          </Text>
        </LiquidGlassSurface>

        <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
          FREQUENTLY ASKED QUESTIONS
        </Text>

        <LiquidGlassSurface style={styles.faqCard}>
          {FAQS.map((faq, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <View key={idx}>
                {idx > 0 && (
                  <View style={[styles.divider, { backgroundColor: palette.glassBorder }]} />
                )}
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setExpandedIndex(isExpanded ? null : idx)}
                  accessibilityRole="button"
                  accessibilityLabel={faq.q}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <Text style={[styles.faqQuestion, { color: palette.textPrimary }]}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={palette.textSecondary}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <Text style={[styles.faqAnswer, { color: palette.textSecondary }]}>
                    {faq.a}
                  </Text>
                )}
              </View>
            );
          })}
        </LiquidGlassSurface>

        <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>
          SUPPORT & LEGAL
        </Text>

        <LiquidGlassSurface style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel="Contact Support"
          >
            <View style={styles.itemIconCircle}>
              <Ionicons name="mail-outline" size={18} color="#00a884" />
            </View>
            <Text style={[styles.itemLabel, { color: palette.textPrimary }]}>
              Contact Support
            </Text>
            <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: palette.glassBorder }]} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleViewLicenses}
            accessibilityRole="button"
            accessibilityLabel="Open Source Licenses"
          >
            <View style={styles.itemIconCircle}>
              <Ionicons name="document-text-outline" size={18} color="#6366f1" />
            </View>
            <Text style={[styles.itemLabel, { color: palette.textPrimary }]}>
              Open Source Licenses
            </Text>
            <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
          </TouchableOpacity>
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
  brandingCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  appLogoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 168, 132, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 13,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  faqCard: {
    borderRadius: 18,
    padding: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 20,
    paddingBottom: 10,
  },
  divider: {
    height: 1,
  },
  menuCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  itemIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
