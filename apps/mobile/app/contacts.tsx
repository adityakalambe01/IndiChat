import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SectionList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  Platform,
  Animated,
  Easing,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import {
  checkContactsPermission,
  requestContactsPermission,
  discoverContacts,
  MatchedContactItem,
  DeviceContactItem,
  ContactDiscoveryResult,
} from '../services/contacts';

// Design tokens matching preview-find-contacts.html exactly
const COLORS = {
  bgDark: '#0b1014',
  appBg: '#111b21',
  surface1: '#202c33',
  surface2: '#222e35',
  surface3: '#2a3942',
  primaryGreen: '#25D366',
  primaryTeal: '#00a884',
  primaryTealDark: '#0a332c',
  textPrimary: '#ffffff',
  textSecondary: '#8696a0',
  textMuted: '#667781',
  textBio: '#aebac1',
  borderSubtle: 'rgba(134, 150, 160, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  borderCard: 'rgba(255, 255, 255, 0.03)',
  dangerRed: '#ea4335',
  warningAmber: '#fbbc04',
  blueAccent: '#53bdeb',
};

// Deterministic colorful avatar backgrounds matching preview
const AVATAR_BG_COLORS = ['#10b981', '#ec4899', '#3b82f6', '#8b5cf6', '#f59e0b'];
function getAvatarBgColor(seed: string): string {
  const lower = seed.toLowerCase();
  if (lower.includes('aarav')) return '#10b981';
  if (lower.includes('priya')) return '#ec4899';
  if (lower.includes('rohan')) return '#3b82f6';
  if (lower.includes('ananya')) return '#8b5cf6';
  if (lower.includes('vikram')) return '#f59e0b';

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

// Sample dataset matching preview-find-contacts.html for visual preview & testing
const PREVIEW_DATA: ContactDiscoveryResult = {
  matched: [
    {
      userId: 'usr-101',
      contactName: 'Aarav Sharma',
      displayName: 'Aarav Sharma',
      username: 'aarav_s',
      phoneNumber: '+91 98765 43210',
      isOnline: true,
      bio: 'Available on IndiChat ✨',
    } as any,
    {
      userId: 'usr-102',
      contactName: 'Priya Patel',
      displayName: 'Priya Patel',
      username: 'priya_p',
      phoneNumber: '+91 98234 56789',
      isOnline: true,
      bio: 'Working on something new 🚀',
    } as any,
    {
      userId: 'usr-103',
      contactName: 'Rohan Verma',
      displayName: 'Rohan Verma',
      username: 'rohan_v',
      phoneNumber: '+91 97123 45678',
      isOnline: false,
      bio: 'Hey there! I am using IndiChat.',
    } as any,
    {
      userId: 'usr-104',
      contactName: 'Ananya Gupta',
      displayName: 'Ananya Gupta',
      username: 'ananya_g',
      phoneNumber: '+91 99887 76655',
      isOnline: true,
      bio: 'Coffee, code, repeat ☕',
    } as any,
    {
      userId: 'usr-105',
      contactName: 'Vikram Rao',
      displayName: 'Vikram Rao',
      username: 'vikram_rao',
      phoneNumber: '+91 98450 12345',
      isOnline: false,
      bio: 'Urgent calls only 📞',
    } as any,
  ],
  unregistered: [
    { id: 'c-6', name: 'Sneha Kulkarni', phoneNumber: '+91 91234 56780' },
    { id: 'c-7', name: 'Karan Mehta', phoneNumber: '+91 92345 67891' },
    { id: 'c-8', name: 'Devendra Singh', phoneNumber: '+91 93456 78902' },
  ],
  totalDeviceContacts: 8,
};

type ScreenStatus = 'checking' | 'prompt' | 'scanning' | 'ready' | 'empty' | 'denied' | 'error';

interface SectionData {
  title: string;
  type: 'matched' | 'invite';
  data: (MatchedContactItem | DeviceContactItem)[];
}

export default function FindContactsScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ state?: string; q?: string }>();
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<any>(null);

  const initialStatus: ScreenStatus = useMemo(() => {
    const s = searchParams.state;
    if (s === 'matches' || s === 'ready') return 'ready';
    if (s === 'scanning' || s === 'loading') return 'scanning';
    if (s === 'empty') return 'empty';
    if (s === 'denied') return 'denied';
    if (s === 'prompt') return 'prompt';
    if (s === 'error') return 'error';
    return 'checking';
  }, [searchParams.state]);

  const [status, setStatus] = useState<ScreenStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.state === 'error' ? 'Unable to sync contacts directory.' : null
  );
  const [discoveryData, setDiscoveryData] = useState<ContactDiscoveryResult | null>(
    searchParams.state === 'matches' || searchParams.state === 'ready' ? PREVIEW_DATA : null
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.q || '');
  const [startingChatId, setStartingChatId] = useState<string | null>(null);
  const [activeGuide, setActiveGuide] = useState<'android' | 'ios'>(
    Platform.OS === 'ios' ? 'ios' : 'android'
  );
  const [loadingStage, setLoadingStage] = useState<1 | 2 | 3>(1);

  // Radar pulse animation
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  const startScanningAnimations = () => {
    pulse1.setValue(0);
    pulse2.setValue(0);
    sweepAnim.setValue(0);

    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    Animated.parallel([
      createPulse(pulse1, 0),
      createPulse(pulse2, 600),
      Animated.loop(
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ),
    ]).start();
  };

  // Check permission on mount (only when not in explicit param state)
  useEffect(() => {
    if (searchParams.state) {
      if (searchParams.state === 'scanning' || searchParams.state === 'loading') {
        startScanningAnimations();
      }
      return;
    }

    let isMounted = true;
    (async () => {
      const perm = await checkContactsPermission();
      if (!isMounted) return;

      if (perm.granted) {
        performDiscovery();
      } else {
        setStatus('prompt');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [searchParams.state]);

  const performDiscovery = async () => {
    setStatus('scanning');
    setErrorMessage(null);
    setLoadingStage(1);
    startScanningAnimations();

    const stageTimer1 = setTimeout(() => {
      setLoadingStage(2);
    }, 600);

    const stageTimer2 = setTimeout(() => {
      setLoadingStage(3);
    }, 1200);

    try {
      const result = await discoverContacts('US');
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setDiscoveryData(result);

      if (result.matched.length === 0 && result.unregistered.length === 0) {
        setStatus('empty');
      } else {
        setStatus('ready');
      }
    } catch (err: any) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      if (err.message === 'PERMISSION_DENIED') {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrorMessage(err.message || 'Unable to sync contacts directory.');
      }
    }
  };

  const handleGrantPermission = async () => {
    const perm = await requestContactsPermission();
    if (perm.granted) {
      performDiscovery();
    } else {
      setStatus('denied');
    }
  };

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('Settings', 'Please open system settings and enable contact permissions for IndiChat.');
    }
  };

  const handleStartChat = async (matched: MatchedContactItem) => {
    if (startingChatId) return;
    setStartingChatId(matched.userId);

    try {
      const conv = await api.createConversation({
        type: 'DIRECT',
        participantIds: [matched.userId],
      });
      const chatTitle = matched.contactName || matched.displayName || matched.username;
      router.push(
        `/chat/${conv.id}?name=${encodeURIComponent(chatTitle)}&type=DIRECT&targetUserId=${matched.userId}`
      );
    } catch (err: any) {
      Alert.alert('Chat Error', err.message || 'Could not start conversation.');
    } finally {
      setStartingChatId(null);
    }
  };

  const handleInvite = async (contact: DeviceContactItem) => {
    try {
      await Share.share({
        title: 'Join me on IndiChat',
        message: `Hey ${contact.name}! I'm using IndiChat for fast, private, and secure messaging. Download the app and chat with me: https://indichat.app`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // Filtered lists based on search query
  const filteredMatches = useMemo(() => {
    if (!discoveryData) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return discoveryData.matched;

    return discoveryData.matched.filter(
      (m) =>
        m.contactName.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.phoneNumber.includes(q)
    );
  }, [discoveryData, searchQuery]);

  const filteredUnregistered = useMemo(() => {
    if (!discoveryData) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return discoveryData.unregistered;

    return discoveryData.unregistered.filter(
      (u) => u.name.toLowerCase().includes(q) || u.phoneNumber.includes(q)
    );
  }, [discoveryData, searchQuery]);

  // SectionList data grouping
  const sections: SectionData[] = useMemo(() => {
    const s: SectionData[] = [];
    if (discoveryData) {
      s.push({
        title: `Contacts on IndiChat (${filteredMatches.length})`,
        type: 'matched',
        data: filteredMatches,
      });

      s.push({
        title: `Invite to IndiChat (${filteredUnregistered.length})`,
        type: 'invite',
        data: filteredUnregistered,
      });
    }
    return s;
  }, [discoveryData, filteredMatches, filteredUnregistered]);

  // 1. App Header
  const renderHeader = () => {
    let headerTitle = 'Find Contacts';
    let headerSubtitle = 'Connect with friends';

    if (status === 'scanning') {
      headerTitle = 'Finding Contacts';
      headerSubtitle =
        loadingStage === 1
          ? 'Scanning address book...'
          : loadingStage === 2
          ? 'Encrypting identifiers...'
          : 'Querying directory...';
    } else if (status === 'ready') {
      headerTitle = 'Select Contact';
      headerSubtitle = `${filteredMatches.length} contacts on IndiChat`;
    } else if (status === 'empty') {
      headerTitle = 'Find Contacts';
      headerSubtitle = '0 contacts found';
    } else if (status === 'denied') {
      headerTitle = 'Contacts Access Denied';
      headerSubtitle = 'Permission Required';
    }

    return (
      <View style={[styles.appHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#aebac1" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {headerTitle}
            </Text>
            <Text style={styles.headerSubtitleText} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>
        </View>

        {status === 'ready' && (
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => searchInputRef.current?.focus()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={20} color="#aebac1" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, { marginLeft: 2 }]}
              onPress={performDiscovery}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Refresh"
            >
              <Ionicons name="refresh" size={18} color="#aebac1" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 2. Search Bar
  const renderSearchBar = () => (
    <View style={styles.searchBarWrap}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // 3. Matched Contact Card
  const renderMatchedContact = (item: MatchedContactItem) => {
    const isStarting = startingChatId === item.userId;
    const initial = (item.displayName || item.contactName || item.username || '?')[0].toUpperCase();
    const avatarBg = getAvatarBgColor(item.contactName || item.displayName || item.userId);
    const bioText = (item as any).bio || 'Available on IndiChat ✨';

    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
        onPress={() => handleStartChat(item)}
      >
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarText}>{initial}</Text>
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactNameText} numberOfLines={1}>
              {item.contactName || item.displayName}
            </Text>
            <View style={styles.badgeIndichat}>
              <Text style={styles.badgeIndichatText}>IndiChat</Text>
            </View>
          </View>

          <View style={styles.contactMeta}>
            <Text style={styles.contactMetaText} numberOfLines={1}>
              @{item.username} • {item.phoneNumber}
            </Text>
          </View>

          <Text style={styles.contactBio} numberOfLines={1}>
            {bioText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.chatActionBtn}
          onPress={() => handleStartChat(item)}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color={COLORS.primaryGreen} />
          ) : (
            <>
              <Ionicons
                name="chatbubble"
                size={14}
                color={COLORS.primaryGreen}
                style={{ marginRight: 5 }}
              />
              <Text style={styles.chatActionText}>Chat</Text>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 4. Invite Contact Card
  const renderInviteContact = (item: DeviceContactItem) => {
    const initial = (item.name || '?')[0].toUpperCase();

    return (
      <View style={styles.contactItem}>
        <View style={[styles.avatar, { backgroundColor: COLORS.surface2 }]}>
          <Text style={[styles.avatarText, { color: COLORS.textSecondary }]}>{initial}</Text>
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactNameText} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View style={styles.contactMeta}>
            <Text style={styles.contactMetaText} numberOfLines={1}>
              {item.phoneNumber}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.inviteActionBtn} onPress={() => handleInvite(item)}>
          <Text style={styles.inviteActionText}>Invite</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 5. Loading Scanner State View (View 2)
  const renderLoadingView = () => {
    const scale1 = pulse1.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 1.8],
    });
    const opacity1 = pulse1.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.8, 0.4, 0],
    });

    const scale2 = pulse2.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 1.8],
    });
    const opacity2 = pulse2.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.8, 0.4, 0],
    });

    const progressTranslate = sweepAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-60, 200],
    });

    let stageBadgeText = '[1/3] Reading device contacts...';
    if (loadingStage === 2) {
      stageBadgeText = '[2/3] Hashing with SHA-256...';
    } else if (loadingStage === 3) {
      stageBadgeText = '[3/3] Querying IndiChat directory...';
    }

    return (
      <View style={styles.loadingContainer}>
        <View style={styles.radarPulseBox}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: scale1 }],
                opacity: opacity1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: scale2 }],
                opacity: opacity2,
              },
            ]}
          />
          <View style={styles.pulseCore}>
            <Ionicons name="search" size={28} color="#0b1014" />
          </View>
        </View>

        <Text style={styles.loadingTitle}>Matching with IndiChat</Text>
        <Text style={styles.loadingSubtitle}>
          Checking phone numbers securely with one-way SHA-256 hashes...
        </Text>

        <View style={styles.progressBarWrap}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                transform: [{ translateX: progressTranslate }],
              },
            ]}
          />
        </View>

        <Text style={styles.loadingStepTag}>{stageBadgeText}</Text>
      </View>
    );
  };

  // 6. Empty State View (View 4)
  const renderEmptyView = () => (
    <View style={styles.emptyStateWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="people-outline" size={36} color={COLORS.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No Contacts on IndiChat Yet</Text>
      <Text style={styles.emptyDesc}>
        None of your contacts have registered with IndiChat. Invite them so you can begin messaging
        securely.
      </Text>
      <TouchableOpacity
        style={styles.emptyInviteBtn}
        onPress={() =>
          Share.share({
            message: 'Join me on IndiChat for secure, fast messaging! Download: https://indichat.app',
          })
        }
      >
        <Ionicons
          name="share-social-outline"
          size={18}
          color="#0b1014"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.emptyInviteBtnText}>Invite Friends</Text>
      </TouchableOpacity>
    </View>
  );

  // 7. Permission Denied State View (View 5)
  const renderDeniedView = () => (
    <View style={styles.deniedStateWrap}>
      <View style={styles.deniedIconCircle}>
        <Ionicons name="lock-closed" size={34} color={COLORS.dangerRed} />
      </View>

      <Text style={styles.deniedTitle}>Permission Needed</Text>
      <Text style={styles.deniedDesc}>
        IndiChat needs access to your contacts to automatically detect friends who are already using
        the app.
      </Text>

      <View style={styles.instructionsCard}>
        <View style={styles.osToggleTabs}>
          <TouchableOpacity
            style={[styles.osTab, activeGuide === 'android' && styles.osTabActive]}
            onPress={() => setActiveGuide('android')}
          >
            <Text style={[styles.osTabText, activeGuide === 'android' && styles.osTabTextActive]}>
              Android Steps
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.osTab, activeGuide === 'ios' && styles.osTabActive]}
            onPress={() => setActiveGuide('ios')}
          >
            <Text style={[styles.osTabText, activeGuide === 'ios' && styles.osTabTextActive]}>
              iOS Steps
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepsList}>
          {activeGuide === 'android' ? (
            <>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Open <Text style={styles.boldWhite}>Settings</Text> &gt;{' '}
                  <Text style={styles.boldWhite}>Apps</Text> &gt;{' '}
                  <Text style={styles.boldWhite}>IndiChat</Text>
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap <Text style={styles.boldWhite}>Permissions</Text>
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap <Text style={styles.boldWhite}>Contacts</Text> and select{' '}
                  <Text style={styles.boldWhite}>Allow</Text>
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Open iOS <Text style={styles.boldWhite}>Settings</Text>
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Scroll down and select <Text style={styles.boldWhite}>IndiChat</Text>
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Toggle <Text style={styles.boldWhite}>Contacts</Text> switch to{' '}
                  <Text style={styles.boldWhite}>ON</Text>
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.primaryFullBtn} onPress={handleOpenSettings}>
        <Ionicons name="settings-outline" size={18} color="#0b1014" style={{ marginRight: 8 }} />
        <Text style={styles.primaryFullBtnText}>Open System Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryFullBtn} onPress={performDiscovery}>
        <Text style={styles.secondaryFullBtnText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  // 8. Permission Explanation Bottom Sheet (Modal Overlay)
  const renderPermissionModal = () => (
    <Modal
      visible={status === 'prompt'}
      transparent
      animationType="slide"
      onRequestClose={() => router.back()}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.permissionBadgeWrap}>
            <Ionicons name="people" size={22} color={COLORS.primaryGreen} />
          </View>

          <Text style={styles.sheetTitle}>Find Contacts on IndiChat</Text>
          <Text style={styles.sheetDesc}>
            IndiChat helps you find friends easily by comparing your phone contacts with existing
            IndiChat accounts.
          </Text>

          <View style={styles.privacyFeatures}>
            <View style={styles.privacyItem}>
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={COLORS.primaryGreen}
                style={styles.privacyIcon}
              />
              <Text style={styles.privacyText}>
                <Text style={styles.boldWhite}>Private &amp; Encrypted: </Text>
                Phone numbers are hashed using SHA-256 before matching.
              </Text>
            </View>

            <View style={styles.privacyItem}>
              <Ionicons
                name="eye-off"
                size={16}
                color={COLORS.primaryGreen}
                style={styles.privacyIcon}
              />
              <Text style={styles.privacyText}>
                <Text style={styles.boldWhite}>Never Sold or Stored: </Text>
                Your address book is only used for account discovery.
              </Text>
            </View>

            <View style={styles.privacyItem}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={COLORS.primaryGreen}
                style={styles.privacyIcon}
              />
              <Text style={styles.privacyText}>
                <Text style={styles.boldWhite}>Revocable anytime: </Text>
                Disconnect sync in Settings &gt; Privacy whenever you want.
              </Text>
            </View>
          </View>

          <View style={styles.sheetButtons}>
            <TouchableOpacity style={styles.primaryFullBtn} onPress={handleGrantPermission}>
              <Ionicons name="checkmark" size={18} color="#0b1014" style={{ marginRight: 6 }} />
              <Text style={styles.primaryFullBtnText}>Allow Contacts Access</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryFullBtn} onPress={() => setStatus('denied')}>
              <Text style={styles.secondaryFullBtnText}>Don't Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      {/* Error Toast Banner */}
      {status === 'error' && (
        <View style={styles.toastBanner}>
          <View style={styles.toastLeft}>
            <Ionicons name="alert-circle" size={16} color="#fecaca" style={{ marginRight: 8 }} />
            <Text style={styles.toastText} numberOfLines={1}>
              {errorMessage || 'Unable to sync contacts directory.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.toastRetryBtn} onPress={performDiscovery}>
            <Text style={styles.toastRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'checking' && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryTeal} />
        </View>
      )}

      {status === 'scanning' && renderLoadingView()}
      {status === 'denied' && renderDeniedView()}
      {status === 'empty' && renderEmptyView()}

      {status === 'ready' && (
        <View style={styles.contentWrap}>
          {renderSearchBar()}

          <SectionList
            sections={sections}
            keyExtractor={(item: any) =>
              'userId' in item ? `matched-${item.userId}` : `invite-${item.id}`
            }
            stickySectionHeadersEnabled={true}
            renderSectionHeader={({ section }: { section: SectionData }) => (
              <View
                style={[
                  styles.sectionHeaderWrap,
                  section.type === 'invite' && { marginTop: 12 },
                ]}
              >
                <Text style={styles.sectionHeaderText}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item, section }: { item: any; section: SectionData }) => {
              if (section.type === 'matched') {
                return renderMatchedContact(item as MatchedContactItem);
              }
              return renderInviteContact(item as DeviceContactItem);
            }}
            renderSectionFooter={({ section }: { section: SectionData }) => {
              if (section.type === 'matched' && section.data.length === 0) {
                return (
                  <View style={styles.emptySectionRow}>
                    <Text style={styles.emptySectionText}>
                      No registered users found matching "{searchQuery}"
                    </Text>
                  </View>
                );
              }
              return null;
            }}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {renderPermissionModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.appBg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.appBg,
  },
  contentWrap: {
    flex: 1,
  },

  // 1. App Header
  appHeader: {
    height: 56,
    width: '100%',
    backgroundColor: COLORS.appBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerTitleBox: {
    marginLeft: 8,
    flex: 1,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 21,
  },
  headerSubtitleText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 2. Search Bar
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.appBg,
  },
  searchBox: {
    backgroundColor: COLORS.surface1,
    borderRadius: 20,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    padding: 0,
  },

  // 3. Section Headers
  sectionHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: COLORS.appBg,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryTeal,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  emptySectionRow: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // 4. Contact Cards
  listContent: {
    paddingBottom: 40,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderCard,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primaryGreen,
    borderWidth: 2,
    borderColor: COLORS.appBg,
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  contactNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  badgeIndichat: {
    backgroundColor: 'rgba(37, 211, 102, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeIndichatText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primaryGreen,
  },
  contactMeta: {
    marginTop: 1,
  },
  contactMetaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  contactBio: {
    fontSize: 12,
    color: COLORS.textBio,
    marginTop: 2,
  },
  chatActionBtn: {
    backgroundColor: COLORS.primaryTealDark,
    borderWidth: 1,
    borderColor: COLORS.primaryTeal,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  chatActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryGreen,
  },
  inviteActionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    flexShrink: 0,
  },
  inviteActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blueAccent,
  },

  // 5. Loading Scanner State (View 2)
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  radarPulseBox: {
    width: 100,
    height: 100,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(37, 211, 102, 0.25)',
  },
  pulseCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryTeal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    maxWidth: 240,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarWrap: {
    width: 200,
    height: 5,
    backgroundColor: COLORS.surface2,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    width: 60,
    backgroundColor: COLORS.primaryGreen,
    borderRadius: 3,
  },
  loadingStepTag: {
    fontSize: 11.5,
    color: COLORS.primaryGreen,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },

  // 6. Empty State View (View 4)
  emptyStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    maxWidth: 270,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyInviteBtn: {
    width: 220,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInviteBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0b1014',
  },

  // 7. Permission Denied State (View 5)
  deniedStateWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  deniedIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(234, 67, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 67, 53, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deniedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  deniedDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    maxWidth: 280,
    textAlign: 'center',
  },
  instructionsCard: {
    width: '100%',
    backgroundColor: COLORS.surface1,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 14,
    padding: 16,
    marginVertical: 18,
  },
  osToggleTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.appBg,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  osTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  osTabActive: {
    backgroundColor: COLORS.surface2,
  },
  osTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  osTabTextActive: {
    color: '#ffffff',
  },
  stepsList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stepText: {
    fontSize: 12,
    color: '#d1d7db',
    flex: 1,
    lineHeight: 18,
  },
  boldWhite: {
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryFullBtn: {
    width: '100%',
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryGreen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryFullBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0b1014',
  },
  secondaryFullBtn: {
    width: '100%',
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryFullBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // 8. Permission Explanation Bottom Sheet (Modal Overlay)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: COLORS.surface2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    alignSelf: 'center',
    marginBottom: 8,
  },
  permissionBadgeWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetDesc: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  privacyFeatures: {
    backgroundColor: COLORS.appBg,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 6,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  privacyIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  privacyText: {
    fontSize: 11,
    color: '#d1d7db',
    lineHeight: 16,
    flex: 1,
  },
  sheetButtons: {
    flexDirection: 'column',
    gap: 8,
  },

  // 9. Toast Error Banner
  toastBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#b91c1c',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  toastText: {
    fontSize: 12,
    color: '#fecaca',
    flex: 1,
  },
  toastRetryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toastRetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
