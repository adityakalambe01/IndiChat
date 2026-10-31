/**
 * apps/mobile/app/settings/server.tsx
 *
 * Dedicated Server Connection Screen:
 *  - Custom backend host configuration (for self-hosting & LAN development)
 *  - Ping test to verify backend reachability and measure round-trip latency
 *  - Unsaved change guard using useUnsavedChangesGuard
 *  - Reset to default auto-detected host
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl, setApiBaseUrl } from '../../services/api';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';

export default function ServerSettingsScreen() {
  const router = useRouter();
  const { palette, metrics } = useTheme();

  const [initialUrl, setInitialUrl] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const url = await getApiBaseUrl();
      setInitialUrl(url);
      setServerUrl(url);
    })();
  }, []);

  const hasUnsavedChanges = serverUrl.trim() !== initialUrl.trim();
  useUnsavedChangesGuard(hasUnsavedChanges);

  const handleTestConnection = async () => {
    const target = serverUrl.trim().replace(/\/+$/, '');
    if (!target) {
      setTestResult({ success: false, message: 'Please enter a valid server URL.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      // Ping the auth login endpoint with empty POST; 400 Bad Request confirms the server is alive
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${target}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (res.status === 400 || res.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully (${latencyMs}ms response time)`,
          latencyMs,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server reachable but responded with HTTP ${res.status}`,
          latencyMs,
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.name === 'AbortError' ? 'Connection timed out (6s)' : `Failed to reach server: ${e.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const clean = serverUrl.trim().replace(/\/+$/, '');
    if (!clean) {
      Alert.alert('Invalid URL', 'Server URL cannot be empty.');
      return;
    }
    await setApiBaseUrl(clean);
    setInitialUrl(clean);
    Alert.alert('Saved', 'Server connection URL updated successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const handleReset = async () => {
    await setApiBaseUrl('');
    const resetUrl = await getApiBaseUrl();
    setServerUrl(resetUrl);
    setInitialUrl(resetUrl);
    setTestResult(null);
    Alert.alert('Reset', 'Server URL reset to environment default.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Server Connection"
        rightIconName="save-outline"
        onRightIconPress={hasUnsavedChanges ? handleSave : undefined}
        rightIconLabel="Save"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.card}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Backend Server Host
          </Text>
          <Text style={[styles.cardDesc, { color: palette.textSecondary }]}>
            Specify the Spring Boot server endpoint. Physical devices cannot reach localhost and need your local LAN IP (e.g. http://192.168.0.70:8080).
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.bgSecondary,
                borderColor: palette.glassBorder,
                color: palette.textPrimary,
              },
            ]}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.0.70:8080"
            placeholderTextColor={palette.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.testBtn, { borderColor: palette.glassBorder }]}
              onPress={handleTestConnection}
              disabled={testing}
              accessibilityRole="button"
              accessibilityLabel="Test Server Connection"
            >
              {testing ? (
                <ActivityIndicator size="small" color={palette.accent} />
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={18} color={palette.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.testBtnText, { color: palette.textPrimary }]}>Test Ping</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: hasUnsavedChanges ? palette.accent : palette.glassBorder,
                  opacity: hasUnsavedChanges ? 1 : 0.6,
                },
              ]}
              onPress={handleSave}
              disabled={!hasUnsavedChanges}
              accessibilityRole="button"
              accessibilityLabel="Save Server URL"
            >
              <Text style={styles.saveBtnText}>Save URL</Text>
            </TouchableOpacity>
          </View>

          {testResult && (
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: testResult.success ? 'rgba(0, 168, 132, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  borderColor: testResult.success ? '#00a884' : '#ef4444',
                },
              ]}
            >
              <Ionicons
                name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                size={20}
                color={testResult.success ? '#00a884' : '#ef4444'}
              />
              <Text
                style={[
                  styles.resultText,
                  { color: testResult.success ? '#00a884' : '#ef4444' },
                ]}
              >
                {testResult.message}
              </Text>
            </View>
          )}
        </LiquidGlassSurface>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel="Reset to Default URL"
        >
          <Text style={[styles.resetBtnText, { color: palette.textSecondary }]}>
            Reset to Environment Default
          </Text>
        </TouchableOpacity>
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
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  testBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#070b0e',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
