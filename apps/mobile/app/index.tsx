import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { wsClient } from '../services/websocket';
import { storage, STORAGE_KEYS } from '../services/storage';
import { settingsService } from '../services/settings';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('Password123!');
  const [displayName, setDisplayName] = useState('Alice');
  const [phoneNumber, setPhoneNumber] = useState('+91 98765 43210');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two-Factor state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorPin, setTwoFactorPin] = useState('');

  // Server URL settings modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  useEffect(() => {
    // Check if already authenticated
    (async () => {
      const currentUrl = await getApiBaseUrl();
      setServerUrl(currentUrl);

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
          // Token expired or invalid
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
          setShow2FAModal(true);
          setLoading(false);
          return;
        }

        if (res.tokens && res.user) {
          setShow2FAModal(false);
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
    try {
      const clean = serverUrl.trim().replace(/\/+$/, '');
      const testRes = await fetch(`${clean}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'ping_test', password: 'test_password' }),
      });
      // Any response (even 401/400) confirms backend server is reached!
      if (testRes.status >= 200 && testRes.status < 500) {
        setConnectionStatus('✅ Connected to backend successfully!');
      } else {
        setConnectionStatus(`⚠️ Server responded with status ${testRes.status}`);
      }
    } catch (err: any) {
      setConnectionStatus(`❌ Connection failed: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = async () => {
    await setApiBaseUrl(serverUrl);
    setShowServerModal(false);
    Alert.alert('Saved', 'Server URL updated successfully.');
  };

  if (checkingAuth) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00a884" />
        <Text style={[styles.subtitle, { marginTop: 12 }]}>Checking session...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Bar with Server Config Button */}
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.serverButton}
              onPress={() => setShowServerModal(true)}
            >
              <Ionicons name="server-outline" size={16} color="#8696a0" />
              <Text style={styles.serverButtonText}>Server Config</Text>
            </TouchableOpacity>
          </View>

          {/* Logo & Branding */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../assets/icon.png')}
                style={{ width: 68, height: 68, borderRadius: 18 }}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.title}>IndiChat</Text>
            <Text style={styles.subtitle}>
              {isRegister ? 'Create your messaging account' : 'Sign in to start messaging'}
            </Text>
          </View>

          {/* Quick Demo Accounts Fill */}
          <View style={styles.demoSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.demoLabel}>Quick Demo Fill:</Text>
              {username === 'alice' && (
                <Text style={{ fontSize: 11, color: '#00a884', fontWeight: '600' }}>
                  2FA PIN: 112233
                </Text>
              )}
            </View>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoPill, username === 'alice' && styles.demoPillActive]}
                onPress={() => handleFillDemo('alice', 'Alice')}
              >
                <Text style={styles.demoPillText}>🔒 Alice</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'bob' && styles.demoPillActive]}
                onPress={() => handleFillDemo('bob', 'Bob')}
              >
                <Text style={styles.demoPillText}>Bob</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'charlie' && styles.demoPillActive]}
                onPress={() => handleFillDemo('charlie', 'Charlie')}
              >
                <Text style={styles.demoPillText}>Charlie</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'david' && styles.demoPillActive]}
                onPress={() => handleFillDemo('david', 'David Miller')}
              >
                <Text style={styles.demoPillText}>David</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'emma' && styles.demoPillActive]}
                onPress={() => handleFillDemo('emma', 'Emma Watson')}
              >
                <Text style={styles.demoPillText}>Emma</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'frank' && styles.demoPillActive]}
                onPress={() => handleFillDemo('frank', 'Frank Castle')}
              >
                <Text style={styles.demoPillText}>Frank</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoPill, username === 'grace' && styles.demoPillActive]}
                onPress={() => handleFillDemo('grace', 'Grace Hopper')}
              >
                <Text style={styles.demoPillText}>Grace</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#f15c6d" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {isRegister && (
              <>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#8696a0" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Display Name"
                    placeholderTextColor="#8696a0"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#8696a0" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (+91 ...)"
                    placeholderTextColor="#8696a0"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={20} color="#8696a0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username or Phone"
                placeholderTextColor="#8696a0"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#8696a0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8696a0"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={() => handleAuth()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#111b21" />
              ) : (
                <Text style={styles.buttonText}>
                  {isRegister ? 'Create Account' : 'Log In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsRegister(!isRegister);
                setErrorMsg(null);
              }}
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>
                {isRegister
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Register Now"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Two-Factor Authentication Modal */}
      <Modal visible={show2FAModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBadge}>
              <Ionicons name="shield-checkmark" size={32} color="#00a884" />
            </View>
            <Text style={styles.modalTitle}>Two-Step Verification</Text>
            <Text style={styles.modalSubtitle}>
              Enter your 6-digit PIN to authenticate this login.
            </Text>

            <TextInput
              style={styles.pinInput}
              placeholder="••••••"
              placeholderTextColor="#8696a0"
              keyboardType="number-pad"
              maxLength={6}
              value={twoFactorPin}
              onChangeText={setTwoFactorPin}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShow2FAModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => handleAuth(twoFactorPin)}
                disabled={loading || twoFactorPin.length < 4}
              >
                {loading ? (
                  <ActivityIndicator color="#111b21" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Verify PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Server Configuration Modal */}
      <Modal visible={showServerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Backend Server Config</Text>
            <Text style={styles.modalSubtitle}>
              Specify the IndiChat backend URL (e.g. your Mac local IP address).
            </Text>

            <TextInput
              style={styles.serverInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.0.70:8080"
              placeholderTextColor="#8696a0"
            />

            {connectionStatus && (
              <Text style={styles.connectionStatusText}>{connectionStatus}</Text>
            )}

            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? (
                <ActivityIndicator size="small" color="#00a884" />
              ) : (
                <Text style={styles.testBtnText}>Test Server Connection</Text>
              )}
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowServerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.modalSubmitText}>Save URL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111b21',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  serverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#202c33',
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  serverButtonText: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#00a884',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00a884',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e9edef',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#8696a0',
    marginTop: 4,
    textAlign: 'center',
  },
  demoSection: {
    backgroundColor: '#202c33',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222e35',
  },
  demoLabel: {
    color: '#8696a0',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  demoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#111b21',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  demoPillActive: {
    borderColor: '#00a884',
    backgroundColor: '#005c4b',
  },
  demoPillText: {
    color: '#e9edef',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(241, 92, 109, 0.12)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(241, 92, 109, 0.3)',
  },
  errorText: {
    color: '#f15c6d',
    fontSize: 13,
    flex: 1,
  },
  form: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202c33',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222e35',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#e9edef',
    fontSize: 16,
  },
  buttonPrimary: {
    backgroundColor: '#00a884',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#111b21',
    fontWeight: '700',
    fontSize: 16,
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
  },
  switchText: {
    color: '#00a884',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#202c33',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a3942',
    alignItems: 'center',
  },
  modalIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,168,132,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e9edef',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8696a0',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: '#111b21',
    borderRadius: 8,
    width: '100%',
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 26,
    letterSpacing: 12,
    color: '#00a884',
    borderWidth: 1,
    borderColor: '#2a3942',
    marginBottom: 20,
  },
  serverInput: {
    backgroundColor: '#111b21',
    borderRadius: 8,
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#e9edef',
    borderWidth: 1,
    borderColor: '#2a3942',
    marginBottom: 12,
  },
  testBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#111b21',
    borderWidth: 1,
    borderColor: '#2a3942',
    marginBottom: 16,
  },
  testBtnText: {
    color: '#00a884',
    fontSize: 13,
    fontWeight: '600',
  },
  connectionStatusText: {
    color: '#8696a0',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#111b21',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  modalCancelText: {
    color: '#8696a0',
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#00a884',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#111b21',
    fontWeight: '700',
  },
});
