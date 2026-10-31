/**
 * apps/mobile/app/index.tsx
 *
 * IndiChat Authentication Screen:
 *  - Matches preview/preview-liquid-glass.html (viewAuth, viewAuth2FA, viewSettingsServer)
 *  - Liquid Glass bento cards, form-field-groups, brand badge, and typography
 *  - Quick Demo account fill (Alice, Bob, Charlie, David)
 *  - Dedicated 2FA PIN challenge view
 *  - Dedicated Server URL configuration with reachability & latency ping
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { wsClient } from '../services/websocket';
import { storage, STORAGE_KEYS } from '../services/storage';
import { settingsService } from '../services/settings';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { useTheme } from '../theme/useTheme';
import { LiquidGlassSurface } from '../components/LiquidGlassSurface';
import { ScreenHeader } from '../components/ScreenHeader';

type AuthViewMode = 'auth' | 'two_factor' | 'server_config';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const { palette, metrics } = useTheme();

  const [viewMode, setViewMode] = useState<AuthViewMode>('auth');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('Password123!');
  const [displayName, setDisplayName] = useState('Alice');
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two-Factor state
  const [twoFactorPin, setTwoFactorPin] = useState('');

  // Server URL settings state
  const [serverUrl, setServerUrl] = useState('');
  const [initialServerUrl, setInitialServerUrl] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (params.mode === '2fa' || params.mode === 'two_factor') {
      setViewMode('two_factor');
    } else if (params.mode === 'server' || params.mode === 'server_config') {
      setViewMode('server_config');
    } else if (params.mode === 'auth') {
      setViewMode('auth');
    }
  }, [params.mode]);

  useEffect(() => {
    (async () => {
      const currentUrl = await getApiBaseUrl();
      setServerUrl(currentUrl);
      setInitialServerUrl(currentUrl);

      const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        try {
          const user = await api.getMe();
          await storage.setJson(STORAGE_KEYS.CURRENT_USER, user);
          await settingsService.loadForUser(user.id);
          wsClient.connect(token);
          registerForPushNotificationsAsync();
          settingsService.syncWithBackend();
          router.replace('/chats');
          return;
        } catch (e) {
          await storage.clearAuth();
        }
      }
      setCheckingAuth(false);
    })();
  }, [router]);

  const handleAuth = async (pin?: string) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({
          username: username.trim(),
          password,
          displayName: displayName.trim() || username.trim(),
          phoneNumber: phoneNumber.trim(),
        });

        if (res.tokens && res.user) {
          await storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.tokens.accessToken);
          await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.tokens.refreshToken);
          await storage.setJson(STORAGE_KEYS.CURRENT_USER, res.user);
          await settingsService.loadForUser(res.user.id);
          wsClient.connect(res.tokens.accessToken);
          registerForPushNotificationsAsync();
          settingsService.syncWithBackend();
          router.replace('/chats');
        }
      } else {
        const res = await api.login({
          usernameOrEmail: username.trim(),
          password,
          twoFactorPin: pin || twoFactorPin || undefined,
        });

        if (res.requiresTwoFactor) {
          setViewMode('two_factor');
          setLoading(false);
          return;
        }

        if (res.tokens && res.user) {
          await storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.tokens.accessToken);
          await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.tokens.refreshToken);
          await storage.setJson(STORAGE_KEYS.CURRENT_USER, res.user);
          await settingsService.loadForUser(res.user.id);
          wsClient.connect(res.tokens.accessToken);
          registerForPushNotificationsAsync();
          settingsService.syncWithBackend();
          router.replace('/chats');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (user: string, name: string) => {
    setUsername(user);
    setDisplayName(name);
    setPassword('Password123!');
    setErrorMsg(null);
    setIsRegister(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    const start = Date.now();
    try {
      const clean = serverUrl.trim().replace(/\/+$/, '');
      const testRes = await fetch(`${clean}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'ping_test', password: 'test_password' }),
      });
      const latency = Date.now() - start;
      if (testRes.status >= 200 && testRes.status < 500) {
        setConnectionStatus(`✅ Connected to backend successfully (${latency}ms)`);
      } else {
        setConnectionStatus(`⚠️ Server responded with HTTP ${testRes.status} (${latency}ms)`);
      }
    } catch (err: any) {
      setConnectionStatus(`❌ Connection failed: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = async () => {
    const clean = serverUrl.trim().replace(/\/+$/, '');
    await setApiBaseUrl(clean);
    setInitialServerUrl(clean);
    setViewMode('auth');
    Alert.alert('Saved', 'Server URL endpoint updated successfully.');
  };

  if (checkingAuth) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={[styles.checkingText, { color: palette.textSecondary }]}>
          Checking session...
        </Text>
      </View>
    );
  }

  // =========================================================================
  // SUB-VIEW 1: Dedicated Server Configuration (viewSettingsServer(true))
  // =========================================================================
  if (viewMode === 'server_config') {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <ScreenHeader
          title="Server Settings"
          showBack={true}
          onBack={() => {
            setServerUrl(initialServerUrl);
            setViewMode('auth');
          }}
          rightActionText="Save"
          onRightAction={handleSaveServerUrl}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: metrics.scrollBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <LiquidGlassSurface style={styles.bentoCard}>
            <View style={styles.formFieldGroup}>
              <Text style={[styles.formFieldLabel, { color: palette.textSecondary }]}>
                Backend Server URL
              </Text>
              <TextInput
                style={[
                  styles.formTextInput,
                  {
                    backgroundColor: palette.surfaceInput,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  },
                ]}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.0.70:8080"
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={[styles.formFieldHint, { color: palette.textSecondary }]}>
                Specify your host LAN IP address (e.g. http://192.168.0.70:8080) for physical mobile access.
              </Text>
            </View>

            <View style={styles.actionPadding}>
              <TouchableOpacity
                style={[styles.testServerBtn, { borderColor: 'rgba(16, 185, 129, 0.35)' }]}
                onPress={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <ActivityIndicator size="small" color="#10b981" />
                ) : (
                  <Text style={styles.testServerBtnText}>Test Server Connection</Text>
                )}
              </TouchableOpacity>

              {connectionStatus ? (
                <Text style={[styles.connectionStatusText, { color: palette.textPrimary }]}>
                  {connectionStatus}
                </Text>
              ) : null}

              <View style={styles.bottomButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: palette.border,
                      backgroundColor: palette.surfaceElevated,
                    },
                  ]}
                  onPress={() => {
                    setServerUrl(initialServerUrl);
                    setViewMode('auth');
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: palette.textPrimary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveEndpointBtn}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.saveEndpointBtnText}>Save Endpoint</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LiquidGlassSurface>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // SUB-VIEW 2: Dedicated 2FA PIN Challenge (viewAuth2FA)
  // =========================================================================
  if (viewMode === 'two_factor') {
    return (
      <View style={[styles.screen, { backgroundColor: palette.bg }]}>
        <ScreenHeader
          title="Two-Step Verification"
          showBack={true}
          onBack={() => setViewMode('auth')}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: metrics.scrollBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <LiquidGlassSurface style={styles.bentoCardPadded}>
            <View style={styles.shieldIconWrap}>
              <Ionicons name="shield-checkmark" size={28} color="#10b981" />
            </View>

            <Text style={[styles.twoFactorTitle, { color: palette.textPrimary }]}>
              Enter 6-Digit PIN
            </Text>

            <Text style={[styles.twoFactorDesc, { color: palette.textSecondary }]}>
              This account is protected with two-step verification. Enter your security PIN to authenticate.
            </Text>

            <TextInput
              style={[
                styles.pinInputHero,
                {
                  backgroundColor: palette.surfaceInput,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
              placeholder="••••••"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={twoFactorPin}
              onChangeText={setTwoFactorPin}
              autoFocus
            />

            <Text style={styles.demoPinNotice}>Demo PIN: 112233</Text>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f43f5e" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || twoFactorPin.length < 4) && styles.btnDisabled,
              ]}
              onPress={() => handleAuth(twoFactorPin)}
              disabled={loading || twoFactorPin.length < 4}
            >
              {loading ? (
                <ActivityIndicator color="#070b0e" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify PIN & Sign In</Text>
              )}
            </TouchableOpacity>
          </LiquidGlassSurface>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // MAIN VIEW: Sign In / Register (viewAuth)
  // =========================================================================
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="IndiChat Access"
        showBack={false}
        rightActionText="Server Config"
        onRightAction={() => {
          setConnectionStatus(null);
          setViewMode('server_config');
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: metrics.scrollBottomPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Branding Hero */}
          <View style={styles.brandHero}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkLetter}>i</Text>
            </View>
            <Text style={[styles.brandTitle, { color: palette.textPrimary }]}>IndiChat</Text>
            <Text style={[styles.brandSubtitle, { color: palette.textSecondary }]}>
              {isRegister
                ? 'Create your encrypted account'
                : 'Sign in to start messaging'}
            </Text>
          </View>

          {/* Quick Demo Accounts Fill */}
          <LiquidGlassSurface style={styles.bentoCardSmall}>
            <View style={styles.demoCardHeader}>
              <Text style={[styles.demoHeaderTitle, { color: palette.textSecondary }]}>
                QUICK DEMO FILL
              </Text>
              <Text style={styles.demoPinText}>2FA PIN: 112233</Text>
            </View>

            <View style={styles.demoChipsWrap}>
              {(['alice', 'bob', 'charlie', 'david'] as const).map((u) => {
                const isSelected = username === u;
                const label = u === 'alice' ? '🔒 Alice' : u.charAt(0).toUpperCase() + u.slice(1);
                return (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.demoPill,
                      {
                        borderColor: isSelected ? '#10b981' : palette.border,
                        backgroundColor: isSelected
                          ? 'rgba(16, 185, 129, 0.18)'
                          : palette.surfaceInput,
                      },
                    ]}
                    onPress={() => handleFillDemo(u, u.charAt(0).toUpperCase() + u.slice(1))}
                  >
                    <Text
                      style={[
                        styles.demoPillText,
                        { color: isSelected ? '#10b981' : palette.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </LiquidGlassSurface>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#f43f5e" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form Fields Card */}
          <LiquidGlassSurface style={styles.bentoCard}>
            {isRegister && (
              <>
                <View style={[styles.formFieldGroup, { borderBottomColor: palette.divider }]}>
                  <Text style={[styles.formFieldLabel, { color: palette.textSecondary }]}>
                    Full Display Name
                  </Text>
                  <TextInput
                    style={[
                      styles.formTextInput,
                      {
                        backgroundColor: palette.surfaceInput,
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    placeholder="e.g. Alice Cooper"
                    placeholderTextColor={palette.textSecondary}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>

                <View style={[styles.formFieldGroup, { borderBottomColor: palette.divider }]}>
                  <Text style={[styles.formFieldLabel, { color: palette.textSecondary }]}>
                    Phone Number (+91...)
                  </Text>
                  <TextInput
                    style={[
                      styles.formTextInput,
                      {
                        backgroundColor: palette.surfaceInput,
                        borderColor: palette.border,
                        color: palette.textPrimary,
                      },
                    ]}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={palette.textSecondary}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}

            <View style={[styles.formFieldGroup, { borderBottomColor: palette.divider }]}>
              <Text style={[styles.formFieldLabel, { color: palette.textSecondary }]}>
                Username or Phone
              </Text>
              <TextInput
                style={[
                  styles.formTextInput,
                  {
                    backgroundColor: palette.surfaceInput,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  },
                ]}
                placeholder="alice"
                placeholderTextColor={palette.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formFieldGroup}>
              <Text style={[styles.formFieldLabel, { color: palette.textSecondary }]}>
                Password
              </Text>
              <TextInput
                style={[
                  styles.formTextInput,
                  {
                    backgroundColor: palette.surfaceInput,
                    borderColor: palette.border,
                    color: palette.textPrimary,
                  },
                ]}
                placeholder="Password123!"
                placeholderTextColor={palette.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
          </LiquidGlassSurface>

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={() => handleAuth()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={isRegister ? 'Create Account' : 'Sign In'}
          >
            {loading ? (
              <ActivityIndicator color="#070b0e" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isRegister ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode Switch Button */}
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
            }}
          >
            <Text style={styles.switchModeText}>
              {isRegister
                ? 'Already have an account? Sign In'
                : "Don't have an account? Register Now"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkingText: {
    fontSize: 14,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  brandHero: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  brandMarkLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#05080b',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  bentoCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  bentoCardSmall: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  bentoCardPadded: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  demoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  demoHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  demoPinText: {
    fontSize: 10.5,
    color: '#10b981',
    fontWeight: '600',
  },
  demoChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  demoPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  demoPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formFieldGroup: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  formFieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  formTextInput: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
  },
  formFieldHint: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 12,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#070b0e',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  switchModeText: {
    color: '#10b981',
    fontSize: 12.5,
    fontWeight: '600',
  },
  // 2FA Specific Styles
  shieldIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  twoFactorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  twoFactorDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  pinInputHero: {
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  demoPinNotice: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 14,
  },
  // Server Config Specific Styles
  actionPadding: {
    padding: 14,
  },
  testServerBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testServerBtnText: {
    color: '#10b981',
    fontSize: 12.5,
    fontWeight: '700',
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveEndpointBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEndpointBtnText: {
    color: '#070b0e',
    fontSize: 13,
    fontWeight: '700',
  },
});
