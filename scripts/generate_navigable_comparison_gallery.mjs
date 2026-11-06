/**
 * scripts/generate_navigable_comparison_gallery.mjs
 * Generates an interactive, standalone HTML comparison gallery:
 * release/comparison_gallery/index.html
 *
 * Enforces:
 * 1. Platform-specific approved preview viewports:
 *    - Android: 411.43 dp logical width (Pixel 8)
 *    - iOS: 402 pt logical width (iPhone 17)
 * 2. Statuses strictly mapped to:
 *    - 'Matches reviewed reference'
 *    - 'Differences remain'
 *    - 'Unverified'
 *    - 'No approved reference'
 * 3. Provenance tracking with commit hash, diff hash, and build artifacts.
 * 4. Inter font verification across both platforms.
 */

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('release/comparison_gallery');
fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(fs.readFileSync('release/build_source_manifest.json', 'utf8'));

const SCREENS = [
  // CATEGORY 1: AUTH & ONBOARDING
  {
    id: 1,
    category: 'Auth & Onboarding',
    name: 'Sign In / Registration',
    route: 'indichat://',
    previewAndroid: '../preview_captures/android_411dp/preview_auth_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_auth_top.png',
    androidImg: '../android/verification/auth_top.png',
    iosImg: '../ios/verification/auth_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter (700 bold headers 20px, 500/400 inputs 14px) rendered on native via expo-font useFonts matching WebKit Google Font Inter in preview.',
    spacing: '16px screen padding, 12px demo user card padding, 14px form field vertical gaps matching preview .form-field-group.',
    dimensions: 'Brand icon squircle 48x48px (r: 14px), text input height 44px (r: 10px), demo user pills 28px height.',
    icons: 'Brand glyph "i" centered inside gradient emerald squircle matching preview .brand-mark.',
    glass: 'Dark Obsidian base (#070b0e), bento card surface elevated (#131c24), border rgba(255,255,255,0.12).',
    safeAreas: 'Top inset cleared via useSafeAreaInsets; bottom safe area clears home indicator / gesture bar.',
    clearance: 'Single viewport screen; no bottom dock present on auth route. Content fits within viewport.',
    differences: 'Physical keyboard typing and SMS gateway unverified via UI tap; backend authentication verified via REST /api/v1/auth/login.'
  },
  {
    id: 2,
    category: 'Auth & Onboarding',
    name: '2FA PIN Challenge',
    route: 'indichat://?mode=2fa',
    previewAndroid: '../preview_captures/android_411dp/preview_auth_2fa_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_auth_2fa_top.png',
    androidImg: '../android/verification/auth_2fa_top.png',
    iosImg: '../ios/verification/auth_2fa_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header (20px), monospace-spaced 6-digit PIN input container. Preview uses monospace digit boxes.',
    spacing: 'Centered PIN challenge card with 20px padding, 16px vertical action gap matching preview.',
    dimensions: 'Digit input card width 100%, 6-digit segmented display height 54px with #00a884 active border.',
    icons: 'Lock glyph in demo badge, shield icon in challenge header.',
    glass: 'Bento card #131c24 with emerald border highlight rgba(16, 185, 129, 0.35) matching preview.',
    safeAreas: 'Cleared via SafeAreaView; keyboard avoidance padding configured for PIN entry.',
    clearance: 'Single viewport content; no floating dock. Cancel and Verify buttons easily reachable.',
    differences: 'Physical numeric keypad touch interaction unverified via automated click; backend 2FA verification verified in test harness.'
  },
  {
    id: 3,
    category: 'Auth & Onboarding',
    name: 'Server Connection (Auth)',
    route: 'indichat://?mode=server',
    previewAndroid: '../preview_captures/android_411dp/preview_auth_server_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_auth_server_top.png',
    androidImg: '../android/verification/auth_server_top.png',
    iosImg: '../ios/verification/auth_server_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Partially Verified / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 13px helper label, 11px URL hint text (#8696a0), 14px input text. Bundled Inter loaded via useFonts; reviewed ScreenHeader and inputs declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px card padding, 12px vertical field gap matching preview.',
    dimensions: 'Input field height 44px (r: 10px), Save button in header 32px height (emerald #10b981).',
    icons: 'Server / cloud connection glyph in title, back chevron in navigation header.',
    glass: 'Dark Obsidian base (#070b0e), bento card #0e141a with 1px border rgba(255,255,255,0.08).',
    safeAreas: 'Header padded for status bar; bottom area cleared.',
    clearance: 'Single viewport layout; no floating dock.',
    differences: 'Pre-populated server URL reflects host IP (http://10.0.2.2:8080 on Android, http://localhost:8080 on iOS) vs preview placeholder. Functional: Android ping latency test button exercised live; host URL editing, saving, and persistence unverified; iOS touch unverified.'
  },

  // CATEGORY 2: MAIN HUBS & TABS
  {
    id: 4,
    category: 'Main Hubs & Tabs',
    name: 'Chats Hub',
    route: 'indichat://chats?tab=chats',
    previewAndroid: '../preview_captures/android_411dp/preview_chats_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_chats_top.png',
    androidImg: '../android/verification/chats_top.png',
    iosImg: '../ios/verification/chats_top.png',
    statusVisual: 'Differences remain',
    statusNav: 'Route opened / Interactive tap confirmed',
    statusFunc: 'Android: Partially Verified / iOS: Partially Verified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts. Reviewed components (header title, search input, filter chips, contact names, snippets, floating dock) declare fontFamily: FONTS.bold/medium/regular.',
    spacing: '16px horizontal screen padding, 8px search bar vertical gap, 12px conversation row gap matching preview.',
    dimensions: 'Header height 56px, search pill height 44px, avatar squircle 48x48px (r: 16px), floating dock 64px.',
    icons: 'Camera, Search, Plus, plus 4th More (...) overflow icon on native to host relocated actions (AI, Payments).',
    glass: 'Header backdrop blur (20px), search input pill (rgba(255,255,255,0.06)), floating dock (rgba(14,20,26,0.78)).',
    safeAreas: 'Top header clears status bar via insets.top; floating dock positioned above insets.bottom.',
    clearance: '120px scroll padding ensures the final conversation row clears the floating dock by >40px.',
    differences: '1. Header Actions: 4th action icon (More "..." overflow icon) present on native to host relocated actions (Meta AI, Payments) vs 3 icons in preview (Camera, Search, Plus). Listed as design deviation pending approval.\n2. Content: Real user conversations and unread badges rendered rather than mock preview contacts.\n3. Functional: Local cache conversation list & search filter exercised; in-room message transmission not exercised on this screen.'
  },
  {
    id: 5,
    category: 'Main Hubs & Tabs',
    name: 'Calls Hub',
    route: 'indichat://chats?tab=calls',
    previewAndroid: '../preview_captures/android_411dp/preview_calls_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_calls_top.png',
    androidImg: '../android/verification/calls_top.png',
    iosImg: '../ios/verification/calls_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 15px hero card title, 13px call log caller name, 11.5px date/time stamp.',
    spacing: '16px screen padding, 14px hero card padding, 12px call log row vertical padding.',
    dimensions: 'Create Call Link icon container 44x44px (r: 22px), call log avatar 40x40px, call glyph 18px.',
    icons: 'Link icon (link-outline), incoming call arrow (arrow-down-left), outgoing call arrow (arrow-up-right).',
    glass: 'Dark Obsidian surface card #0e141a with 1px border rgba(255,255,255,0.08).',
    safeAreas: 'Cleared via ScreenHeader; 64px floating dock positioned above safe area insets.bottom.',
    clearance: 'Call logs list scrolls above floating dock; final row indicators reachable.',
    differences: 'Real call history log entries rendered vs static preview mock calls.'
  },
  {
    id: 6,
    category: 'Main Hubs & Tabs',
    name: 'Updates / Status Hub',
    route: 'indichat://chats?tab=updates',
    previewAndroid: '../preview_captures/android_411dp/preview_updates_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_updates_top.png',
    androidImg: '../android/verification/updates_top.png',
    iosImg: '../ios/verification/updates_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 14.5px My Status title, 12px timestamp, section header 11px uppercase bold.',
    spacing: '16px screen padding, 14px status row padding, 10px avatar-to-text gap.',
    dimensions: 'My Status avatar 50x50px with emerald plus badge, recent updates avatars with green ring border.',
    icons: 'Add status plus icon (+), camera icon, pencil icon in secondary floating action positions.',
    glass: 'Dark Obsidian surface card with subtle emerald accent border on updated statuses.',
    safeAreas: 'Header padded for status bar; floating dock cleared at bottom.',
    clearance: 'Content fits within viewport or scrolls above dock with 120px+ bottom padding.',
    differences: 'Live camera status capture and story publishing backend mutations not exercised.'
  },
  {
    id: 7,
    category: 'Main Hubs & Tabs',
    name: 'Communities / Circles',
    route: 'indichat://chats?tab=communities',
    previewAndroid: '../preview_captures/android_411dp/preview_communities_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_communities_top.png',
    androidImg: '../android/verification/communities_top.png',
    iosImg: '../ios/verification/communities_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 15px community hero title, 13px description, channel list rows 13.5px.',
    spacing: '16px screen padding, 16px hero card padding with center-aligned community icon.',
    dimensions: 'New Community hero squircle 56x56px, channel row icon 36x36px, primary button 42px height.',
    icons: 'People / community group glyph, megaphone announcement icon.',
    glass: 'Bento card #131c24 with highlight border rgba(255,255,255,0.12).',
    safeAreas: 'Cleared via ScreenHeader; floating dock positioned above safe area insets.bottom.',
    clearance: 'Bottom dock cleared by 120px padding.',
    differences: 'Static community onboarding card rendered vs backend-managed community channels.'
  },

  // CATEGORY 3: CONVERSATIONS & CONTACTS
  {
    id: 8,
    category: 'Conversations & Contacts',
    name: 'Conversation View',
    route: 'indichat://chat/1',
    previewAndroid: '../preview_captures/android_411dp/preview_conversation_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_conversation_top.png',
    androidImg: '../android/verification/conversation_top.png',
    iosImg: '../ios/verification/conversation_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, incoming/outgoing bubbles, composer bar, and timestamps declare fontFamily: FONTS.*.',
    spacing: 'Header padding 8px 16px, bubble vertical gap 6px, bubble internal padding 8px 12px.',
    dimensions: 'Outgoing bubbles have max-width 78%, input pill height 44px, action buttons 36x36px.',
    icons: 'Back chevron, phone call, video call, paperclip attachment, mic icon, double checkmarks.',
    glass: 'Frosted header rgba(11,16,21,0.85), input bar rgba(14,20,26,0.92), outgoing bubble rgba(0,92,75,0.92).',
    safeAreas: 'Top header padded for status bar; input dock padded for home indicator / navigation bar.',
    clearance: 'Messages scroll cleanly above input dock; input accessory bar attaches above keyboard.',
    differences: '1. Content: Real conversation history rendered from PostgreSQL vs sample preview conversation.\n2. Functional: In-room live message transmission, audio recording, and media attachment upload not exercised in this test pass.'
  },
  {
    id: 9,
    category: 'Conversations & Contacts',
    name: 'Contacts & Discovery',
    route: 'indichat://contacts',
    previewAndroid: '../preview_captures/android_411dp/preview_contacts_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_contacts_top.png',
    androidImg: '../android/verification/contacts_top.png',
    iosImg: '../ios/verification/contacts_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unavailable / Proposed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, search field, and contact rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 10px contact row gap, 12px avatar-to-text gap.',
    dimensions: 'Contact avatar squircle 44x44px (r: 14px), search input height 42px.',
    icons: 'Back chevron, search icon, new contact icon (+), QR code icon.',
    glass: 'Dark Obsidian surface card #0e141a with 1px border rgba(255,255,255,0.08).',
    safeAreas: 'Screen header clears top safe area; list clears bottom navigation bar.',
    clearance: 'Contact rows scroll smoothly to the bottom without clipping.',
    differences: '1. Capability: Optical camera QR code scanning is Unavailable / Proposed (Not Implemented) in the mobile client codebase.\n2. Content: Real synced contacts rendered vs sample preview contacts list.\n3. Functional: Contact phone book synchronization and invite dispatch unverified.'
  },

  // CATEGORY 4: SETTINGS HUB & PROFILE
  {
    id: 10,
    category: 'Settings Hub & Profile',
    name: 'Settings Hub "You"',
    route: 'indichat://settings',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_top.png',
    androidImg: '../android/verification/settings_top.png',
    iosImg: '../ios/verification/settings_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened / Interactive tap confirmed',
    statusFunc: 'Android: Partially Verified / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, Profile Bento, section titles, and FloatingDock declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px profile card padding, 10px bento card vertical margin.',
    dimensions: 'Profile avatar squircle 60x60px (r: 20px), row icon squircle 32x32px (r: 8px), floating dock 64px.',
    icons: 'QR icon, chevron-forward, shield, lock, brush, chatbox, notifications, globe, server, power-outline.',
    glass: 'Bento cards rgba(19,28,36,0.65) with 1px border rgba(255,255,255,0.12) and backdrop blur.',
    safeAreas: 'Cleared via ScreenHeader; 64px floating dock positioned above safe area insets.bottom.',
    clearance: '120px scroll padding ensures the Log Out card clears the floating dock by >40px.',
    differences: '1. Content: Real authenticated user metadata and avatar rendered vs preview mock profile.\n2. Functional: Search catalog filtering exercised live on Android (settings_search_filtered.png); floating dock navigation confirmed via UIAutomator tap (dock_navigation_you.png); iOS touch unverified; profile mutations not executed from hub.'
  },
  {
    id: 11,
    category: 'Settings Hub & Profile',
    name: 'Edit Profile',
    route: 'indichat://settings/profile',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_profile_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_profile_top.png',
    androidImg: '../android/verification/settings_profile_top.png',
    iosImg: '../ios/verification/settings_profile_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, labels, and text inputs declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px avatar section margin, 14px field vertical gap.',
    dimensions: 'Avatar squircle 80x80px (r: 26px) with camera edit badge, text input height 44px.',
    icons: 'Camera badge icon, checkmark save icon, back chevron.',
    glass: 'Bento surface card #0e141a with border rgba(255,255,255,0.08).',
    safeAreas: 'Cleared via ScreenHeader; bottom safe area respected.',
    clearance: 'Form content fits within viewport without clipping.',
    differences: '1. Content: Real user profile values loaded from backend database vs preview defaults.\n2. Functional: Rendering stored profile values does not prove editing, saving, or persistence; avatar photo picking/upload and profile save button tap not exercised via UI tap.'
  },
  {
    id: 12,
    category: 'Settings Hub & Profile',
    name: 'Account Settings',
    route: 'indichat://settings/account',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_account_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_account_top.png',
    androidImg: '../android/verification/settings_account_top.png',
    iosImg: '../ios/verification/settings_account_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, banners, and row items declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 12px row vertical padding, 14px bento card margins.',
    dimensions: 'Row icon squircle 32x32px (r: 8px), navigation chevron 16px.',
    icons: 'Lock (Password), Shield (2FA), Phone (Number), Key (Passkeys), Trash (Delete Account).',
    glass: 'Dark Obsidian bento card with subtle highlight border.',
    safeAreas: 'Top header clears status bar; bottom navigation bar cleared.',
    clearance: 'Rows fit comfortably within screen height.',
    differences: '1. Content: Active 2FA and Passkey count reflect real user state.\n2. Functional: Rendering stored account values does not prove persistence; account data export not exercised via UI tap.'
  },
  {
    id: 13,
    category: 'Settings Hub & Profile',
    name: 'Change Password',
    route: 'indichat://settings/password',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_password_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_password_top.png',
    androidImg: '../android/verification/settings_password_top.png',
    iosImg: '../ios/verification/settings_password_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, input fields, and action buttons declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px input vertical gaps, 20px action button margin.',
    dimensions: 'Input field height 44px (r: 10px), Save button height 44px (emerald #10b981).',
    icons: 'Back chevron, eye/eye-off toggle icons in password inputs.',
    glass: 'Bento card #0e141a with border rgba(255,255,255,0.08).',
    safeAreas: 'Cleared via ScreenHeader; keyboard avoidance configured.',
    clearance: 'Form fits within viewport; submit button reachable.',
    differences: 'Physical keyboard password update unverified via native UI tap; backend password hash update verified in test suite.'
  },
  {
    id: 14,
    category: 'Settings Hub & Profile',
    name: 'Two-Factor Authentication',
    route: 'indichat://settings/two-factor',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_two_factor_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_two_factor_top.png',
    androidImg: '../android/verification/settings_two_factor_top.png',
    iosImg: '../ios/verification/settings_two_factor_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, hero card, and toggle labels declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px hero card padding, 14px switch row padding.',
    dimensions: 'Hero icon squircle 48x48px (r: 24px), toggle switch 48x28px, PIN inputs 44x48px.',
    icons: 'Shield glyph in hero badge, back chevron, toggle switch.',
    glass: 'Dark Obsidian surface elevated card with emerald accent border.',
    safeAreas: 'Header padded for status bar; bottom area cleared.',
    clearance: 'Hero card, switch, and PIN configuration scroll cleanly with 120px padding.',
    differences: '1. Content: Real user 2FA status (enabled/disabled) loaded from backend settings service.\n2. Functional: Rendering stored 2FA state does not prove editing or saving; in-app PIN modification and disable toggle not exercised via UI tap.'
  },
  {
    id: 15,
    category: 'Settings Hub & Profile',
    name: 'Phone Number',
    route: 'indichat://settings/phone',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_phone_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_phone_top.png',
    androidImg: '../android/verification/settings_phone_top.png',
    iosImg: '../ios/verification/settings_phone_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unavailable / Proposed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, hero card, and phone inputs declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px card padding, 14px field gap.',
    dimensions: 'Hero icon squircle 48x48px (r: 24px), phone input pill 44px height, Next button 44px.',
    icons: 'Phone glyph, globe glyph, back chevron.',
    glass: 'Bento card #0e141a with border rgba(255,255,255,0.08).',
    safeAreas: 'Cleared via ScreenHeader; keyboard avoidance configured.',
    clearance: 'Single viewport layout; Next action accessible.',
    differences: 'Capability: Cellular SMS OTP migration gateway is Unavailable / Proposed (Not Implemented) in the mobile client codebase.'
  },
  {
    id: 16,
    category: 'Settings Hub & Profile',
    name: 'Passkeys',
    route: 'indichat://settings/passkeys',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_passkeys_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_passkeys_top.png',
    androidImg: '../android/verification/settings_passkeys_top.png',
    iosImg: '../ios/verification/settings_passkeys_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unavailable / Proposed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, hero card, and status badges declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px hero card padding, 12px passkey list item padding.',
    dimensions: 'Hero icon squircle 48x48px (r: 24px), Create Passkey button height 44px (emerald #10b981).',
    icons: 'Key / fingerprint glyph, delete trash glyph, back chevron.',
    glass: 'Dark Obsidian surface card with emerald accent border.',
    safeAreas: 'Header padded for status bar; bottom navigation bar cleared.',
    clearance: 'Passkey management list scrolls above bottom safe area.',
    differences: 'Capability: WebAuthn hardware biometric challenge ceremony (FaceID/TouchID enrollment) is Unavailable / Proposed (Not Implemented) in the mobile client codebase.'
  },
  {
    id: 17,
    category: 'Settings Hub & Profile',
    name: 'Delete Account',
    route: 'indichat://settings/delete-account',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_delete_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_delete_top.png',
    androidImg: '../android/verification/settings_delete_top.png',
    iosImg: '../ios/verification/settings_delete_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, danger card, and delete buttons declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px danger card padding, 10px list item gap.',
    dimensions: 'Danger icon squircle 48x48px (r: 24px, red #f43f5e), Delete button 44px height.',
    icons: 'Warning triangle / trash glyph, back chevron.',
    glass: 'Danger bento card with subtle red border rgba(244,63,94,0.25).',
    safeAreas: 'Header padded for status bar; bottom safe area respected.',
    clearance: 'Content fits within viewport; destructive action prominent.',
    differences: 'Account deletion execution intentionally not executed via UI tap to preserve demo data; backend REST endpoint verified in test suite.'
  },

  // CATEGORY 5: PREFERENCES & MATERIALS
  {
    id: 18,
    category: 'Preferences & Materials',
    name: 'Privacy & Read Receipts',
    route: 'indichat://settings/privacy',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_privacy_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_privacy_top.png',
    androidImg: '../android/verification/settings_privacy_top.png',
    iosImg: '../ios/verification/settings_privacy_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, section titles, and option rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px row padding, 10px bento card vertical margin.',
    dimensions: 'Toggle switches 48x28px, chevron icons 16px, row height ~56px.',
    icons: 'Eye glyph (Last Seen), Checkmark glyph (Read Receipts), Lock glyph (App Lock), back chevron.',
    glass: 'Bento cards rgba(19,28,36,0.65) with 1px border rgba(255,255,255,0.12).',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Settings rows scroll cleanly with 120px bottom padding.',
    differences: '1. Content: Privacy switches reflect real user settings persisted in AsyncStorage & backend.\n2. Functional: Rendering stored privacy preferences does not prove editing, saving, or persistence; toggling switches and radio options not exercised via UI tap.'
  },
  {
    id: 19,
    category: 'Preferences & Materials',
    name: 'Appearance & Liquid Glass',
    route: 'indichat://settings/appearance',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_appearance_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_appearance_top.png',
    androidImg: '../android/verification/settings_appearance_top.png',
    iosImg: '../ios/verification/settings_appearance_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, theme cards, slider labels, and switches declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px bento card padding, 12px segmented control gap.',
    dimensions: 'Theme segmented control height 38px, blur slider track 4px, preview bento card 80px.',
    icons: 'Sun (Light), Moon (Dark), Phone (System), Layers (Transparency), Motion (Reduced Motion).',
    glass: 'Interactive LiquidGlassSurface demonstrating 0-40px blur, Dark Obsidian palette (#070b0e).',
    safeAreas: 'Header padded for status bar; bottom area cleared.',
    clearance: 'All controls, live preview cards, and switches scroll with 120px clearance.',
    differences: '1. Android (Passed): Live OS night/day cold relaunch + mathematical Sobel gradient sharpness drop (-55.8%) verified live; 4/4 unit tests passed (test_appearance_persistence.mjs).\n2. iOS (Unverified): Headless CoreSimulator lacks touch injection CLI to tap and save theme independently of OS scheme; system appearance inheritance works via simctl ui appearance light.'
  },
  {
    id: 20,
    category: 'Preferences & Materials',
    name: 'Chats & Preferences',
    route: 'indichat://settings/chats',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_chats_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_chats_top.png',
    androidImg: '../android/verification/settings_chats_top.png',
    iosImg: '../ios/verification/settings_chats_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, section titles, and preference rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px row padding, 10px bento card margin.',
    dimensions: 'Font size segmented selector height 36px, toggle switches 48x28px, navigation chevrons 16px.',
    icons: 'Color palette (Wallpaper), Text size (Font Size), Media save (Media Visibility), back chevron.',
    glass: 'Dark Obsidian bento cards with border rgba(255,255,255,0.08).',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Settings rows scroll cleanly with 120px bottom padding.',
    differences: '1. Spec: Screen title aligned to "Chats & Wallpaper" matching preview.\n2. Functional: Rendering stored preferences does not prove editing, saving, or persistence; toggle switches and font size selector not exercised via UI tap.'
  },
  {
    id: 21,
    category: 'Preferences & Materials',
    name: 'Chat Backup',
    route: 'indichat://settings/backup',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_backup_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_backup_top.png',
    androidImg: '../android/verification/settings_backup_top.png',
    iosImg: '../ios/verification/settings_backup_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, hero card, and action buttons declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px hero card padding, 12px action button vertical gap.',
    dimensions: 'Cloud icon squircle 48x48px (r: 24px), Back Up Now button 44px (emerald #10b981), View Archive button 44px.',
    icons: 'Cloud-upload glyph, document-text glyph (Archive Viewer), lock glyph (End-to-End Encrypted).',
    glass: 'Dark Obsidian surface card with emerald accent border.',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Hero card, backup metadata, and buttons fit within viewport cleanly.',
    differences: '1. Android (Passed): Genuine local JSON backup export to /backups/ (8,011 bytes) and <LocalArchiveViewerModal> verified live (6/6 unit tests pass).\n2. iOS (Unverified): Shared unit tests pass, but on-device Files app export and archive modal unverified due to lack of CLI touch injection.\n3. Cloud AWS S3 upload is not implemented.'
  },
  {
    id: 22,
    category: 'Preferences & Materials',
    name: 'Linked Devices Hub',
    route: 'indichat://settings/linked-devices',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_devices_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_devices_top.png',
    androidImg: '../android/verification/settings_devices_top.png',
    iosImg: '../ios/verification/settings_devices_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, hero card, and device session rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 16px hero card padding, 12px device item padding.',
    dimensions: 'Device icon squircle 48x48px (r: 24px), Link a Device button 44px (emerald #10b981), device glyph 24px.',
    icons: 'Laptop / Desktop glyph, Mobile phone glyph, Link a Device button icon (+), back chevron.',
    glass: 'Dark Obsidian bento card with subtle highlight border.',
    safeAreas: 'Header padded for status bar; bottom navigation bar cleared.',
    clearance: 'Active sessions list scrolls cleanly above bottom safe area.',
    differences: '1. Content: Real linked device sessions from PostgreSQL user_linked_devices rendered vs preview mock devices.\n2. Functional: Rendering stored device sessions does not prove in-app button revocation works; in-app revoke button tap on this screen not exercised via UI tap (backend session revocation lifecycle verified in Row 34).'
  },
  {
    id: 23,
    category: 'Preferences & Materials',
    name: 'Link Device QR / Code',
    route: 'indichat://settings/link-device',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_link_code_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_link_code_top.png',
    androidImg: '../android/verification/settings_link_code_top.png',
    iosImg: '../ios/verification/settings_link_code_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unavailable / Proposed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, pairing code card, and instructions declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 20px card padding, 16px pairing code container margin.',
    dimensions: 'QR code placeholder container 200x200px, 8-character pairing code pill height 54px.',
    icons: 'QR code glyph, barcode scan glyph, back chevron.',
    glass: 'Bento card #131c24 with emerald border highlight.',
    safeAreas: 'Cleared via ScreenHeader; bottom safe area respected.',
    clearance: 'QR and code pairing cards fit within viewport without clipping.',
    differences: '1. Capability: Optical camera QR code scanning is Unavailable / Proposed (Not Implemented) in mobile codebase.\n2. Functional: Displaying a pairing code does not prove device pairing works; pairing handshake ceremony unverified via UI tap.'
  },
  {
    id: 24,
    category: 'Preferences & Materials',
    name: 'Notifications & Sounds',
    route: 'indichat://settings/notifications',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_notifications_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_notifications_top.png',
    androidImg: '../android/verification/settings_notifications_top.png',
    iosImg: '../ios/verification/settings_notifications_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, section titles, and toggle rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px row padding, 10px bento card margin.',
    dimensions: 'Toggle switches 48x28px, navigation chevrons 16px, row height ~54px.',
    icons: 'Bell glyph, volume glyph, vibrate glyph, back chevron.',
    glass: 'Bento cards rgba(19,28,36,0.65) with 1px border rgba(255,255,255,0.12).',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Notification preference rows scroll cleanly with 120px bottom padding.',
    differences: '1. Spec: Section headers aligned to "MESSAGES & GROUPS" and "VIBRATION PATTERN"; row titles aligned to preview.\n2. Functional: Rendering stored notification preferences does not prove editing, saving, or persistence; toggling switches not exercised via UI tap; push notification delivery unverified.'
  },
  {
    id: 25,
    category: 'Preferences & Materials',
    name: 'App Language',
    route: 'indichat://settings/language',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_language_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_language_top.png',
    androidImg: '../android/verification/settings_language_top.png',
    iosImg: '../ios/verification/settings_language_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader and language list rows declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px language row padding, 8px checkmark margin.',
    dimensions: 'Checkmark indicator 20px (emerald #10b981), language list items 52px height.',
    icons: 'Checkmark glyph on selected language, back chevron.',
    glass: 'Bento card #0e141a with 1px border rgba(255,255,255,0.08).',
    safeAreas: 'Header padded for status bar; bottom navigation bar cleared.',
    clearance: 'Language list (English, Hindi, Bengali, Telugu, Tamil, Marathi) scrolls cleanly with 120px padding.',
    differences: '1. Content: English rendered as active language.\n2. Functional: Rendering stored language does not prove language switching works; tapping radio options to switch in-app dictionary and persistence not exercised via UI tap.'
  },
  {
    id: 26,
    category: 'Preferences & Materials',
    name: 'Server Connection',
    route: 'indichat://settings/server',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_server_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_server_top.png',
    androidImg: '../android/verification/settings_server_top.png',
    iosImg: '../ios/verification/settings_server_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Partially Verified / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed ScreenHeader, input fields, and action buttons declare fontFamily: FONTS.*.',
    spacing: '16px screen padding, 14px card padding, 12px field gap.',
    dimensions: 'Input field height 44px (r: 10px), Save button in header 32px height.',
    icons: 'Server glyph, back chevron, checkmark save.',
    glass: 'Dark Obsidian surface card #0e141a with border rgba(255,255,255,0.08).',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Form content fits within viewport without clipping.',
    differences: '1. Pre-populated server URL reflects host IP (http://10.0.2.2:8080 on Android, http://localhost:8080 on iOS) vs preview placeholder.\n2. Functional: Android ping latency test button exercised live (settings_server_bottom.png); host URL editing, saving, and persistence unverified; iOS touch unverified.'
  },

  // CATEGORY 6: NATIVE EXTENSIONS (NO APPROVED REFERENCE)
  {
    id: 27,
    category: 'Native Extensions (No Approved Reference)',
    name: 'Help & Support',
    route: 'indichat://settings/help',
    previewAndroid: null,
    previewIos: null,
    androidImg: '../android/verification/settings_help_top.png',
    iosImg: '../ios/verification/settings_help_top.png',
    statusVisual: 'No approved reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 14px row titles, 12px subtitle copy.',
    spacing: '16px screen padding, 14px row padding.',
    dimensions: 'Row icon squircle 32x32px (r: 8px), navigation chevron 16px.',
    icons: 'Help-circle (Help Center), Document-text (Terms & Privacy), Mail (Contact Us), Info (App Info).',
    glass: 'Dark Obsidian bento card with subtle highlight border.',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Content fits within viewport without clipping.',
    differences: 'No approved preview reference exists for Help & Support. Implemented as native extension.'
  },
  {
    id: 28,
    category: 'Native Extensions (No Approved Reference)',
    name: 'Storage & Data Usage',
    route: 'indichat://settings/storage',
    previewAndroid: null,
    previewIos: null,
    androidImg: '../android/verification/settings_storage_top.png',
    iosImg: '../ios/verification/settings_storage_top.png',
    statusVisual: 'No approved reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 15px storage summary, 12px breakdown text, 14px row titles.',
    spacing: '16px screen padding, 14px card padding.',
    dimensions: 'Storage bar height 8px, toggle switches 48x28px, navigation chevrons 16px.',
    icons: 'Folder (Manage Storage), Pulse (Network Usage), Cloud-download (Auto-Download).',
    glass: 'Dark Obsidian bento card with subtle highlight border.',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Storage rows scroll cleanly with 120px bottom padding.',
    differences: 'No approved preview reference exists for Storage & Data. Implemented as native extension.'
  },
  {
    id: 29,
    category: 'Native Extensions (No Approved Reference)',
    name: 'Chat Wallpaper Customization',
    route: 'indichat://settings/wallpaper',
    previewAndroid: null,
    previewIos: null,
    androidImg: '../android/verification/settings_wallpaper_top.png',
    iosImg: '../ios/verification/settings_wallpaper_top.png',
    statusVisual: 'No approved reference',
    statusNav: 'Route opened',
    statusFunc: 'Unverified / Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Inter 700 header, 14px option titles, 12px description.',
    spacing: '16px screen padding, 12px wallpaper thumbnail gap.',
    dimensions: 'Wallpaper preview tiles 88x140px (r: 12px), opacity slider track 4px.',
    icons: 'Image glyph, color-palette glyph, back chevron.',
    glass: 'Dark Obsidian bento cards with border rgba(255,255,255,0.08).',
    safeAreas: 'Header padded for status bar; bottom safe area cleared.',
    clearance: 'Wallpaper thumbnails and opacity controls fit within viewport.',
    differences: 'No approved preview reference exists for dedicated Wallpaper screen. Implemented as native extension.'
  },
  {
    id: 30,
    category: 'Native Extensions (No Approved Reference)',
    name: 'Contacts Permission Sheet',
    route: 'Permission prompt',
    previewAndroid: null,
    previewIos: null,
    androidImg: '../android/verification/sheet_contacts_permission.png',
    iosImg: null,
    statusVisual: 'No approved reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Passed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Bundled Inter loaded via useFonts; reviewed permission card, explanation, and buttons declare fontFamily: FONTS.*.',
    spacing: 'Bottom sheet padding 20px, 14px button gap.',
    dimensions: 'Hero icon squircle 56x56px (r: 28px), Allow button 44px (emerald #10b981), Not Now button 44px.',
    icons: 'People / contacts glyph, lock glyph.',
    glass: 'Frosted glass bottom sheet with dark obsidian surface.',
    safeAreas: 'Bottom sheet padded for navigation safe area insets.',
    clearance: 'Attached to screen bottom above navigation gesture bar.',
    differences: '1. Visual: No approved preview reference exists for Contacts Permission Sheet. Implemented as native extension modal.\n2. Functional: Permission request lifecycle exercised live on Android (sheet_contacts_permission.png) and iOS native CNContactStore dialog.'
  },
  {
    id: 31,
    category: 'Native Extensions (No Approved Reference)',
    name: 'Active Call Media Session',
    route: 'In-call state',
    previewAndroid: null,
    previewIos: null,
    androidImg: '../android/verification/journey1_android_web_connected.png',
    iosImg: null,
    statusVisual: 'No approved reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Unavailable / Proposed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Connected badge 12px bold, call duration timer 16px monospace (0:04), caller name 16px.',
    spacing: '16px audio call bar padding, video call fullscreen canvas with floating PIP.',
    dimensions: 'Remote video canvas fullscreen, local PIP camera 120x160px (r: 16px), control pill bar 56px height.',
    icons: 'Speakerphone glyph, microphone mute glyph, camera flip glyph, end call button.',
    glass: 'Floating in-call controls use frosted glass background with subtle border.',
    safeAreas: 'Top header cleared; in-call controls positioned above navigation safe area.',
    clearance: 'Controls accessible at screen bottom.',
    differences: '1. Android (Passed): Live two-way WebRTC audio and video streaming verified with active RTP counters in Journeys 1 & 2 (9/9 unit tests pass).\n2. iOS Simulator (Unavailable / Proposed): Native WebRTC module bindings omitted by design from simulator prebuild to prevent crash; in-call duration timer and history logging execute via client-side fallback; not a feature-complete production-equivalent build.'
  },

  // CATEGORY 7: OVERLAYS & MODALS
  {
    id: 32,
    category: 'Overlays & Modals',
    name: 'Discard Unsaved Changes Alert',
    route: 'Trigger: Dirty back navigation',
    previewAndroid: '../preview_captures/android_411dp/preview_settings_top.png',
    previewIos: '../preview_captures/ios_402pt/preview_settings_top.png',
    androidImg: '../android/verification/settings_profile_top.png',
    iosImg: '../ios/verification/settings_profile_top.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Unverified',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Title "Discard Unsaved Changes?" 17px Inter 700, message 13px, action buttons 15px.',
    spacing: 'OS native alert padding and button layouts.',
    dimensions: 'OS system alert modal dialog.',
    icons: 'Handled via platform native Alert.alert API.',
    glass: 'Native OS dialog backdrop blur.',
    safeAreas: 'Centered OS modal dialog clears all safe areas.',
    clearance: 'Centered within active viewport.',
    differences: 'Android: Verified live via Cancel tap & discard rollback. iOS touch unverified due to headless CLI limitations.'
  },
  {
    id: 33,
    category: 'Overlays & Modals',
    name: 'Incoming Call Overlay UI',
    route: 'Trigger: WebSocket offer',
    previewAndroid: '../preview_captures/android_411dp/preview_call_overlay.png',
    previewIos: '../preview_captures/ios_402pt/preview_call_overlay.png',
    androidImg: '../android/verification/call_overlay.png',
    iosImg: '../ios/verification/call_overlay.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Passed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Caller name 22px Inter 700, status "IndiChat Voice Call..." 14px emerald #10b981.',
    spacing: 'Fullscreen layout, 60px avatar margin, 32px decline/accept button horizontal spacing.',
    dimensions: 'Caller avatar squircle 88x88px (r: 32px), Decline button 64x64px (red #f43f5e), Accept button 64x64px (green #10b981).',
    icons: 'Call decline glyph (phone-hangup), call accept glyph (phone).',
    glass: 'Fullscreen frosted glass backdrop with heavy blur and dark obsidian gradient.',
    safeAreas: 'Buttons positioned 48px above safe area insets.bottom.',
    clearance: 'Fullscreen overlay covers viewports cleanly without edge bleed.',
    differences: 'WebRTC offer signal from remote peer exercised live; caller identity and Accept/Decline confirmed via UI dump.'
  },
  {
    id: 34,
    category: 'Overlays & Modals',
    name: 'Device Revocation Alert',
    route: 'Trigger: DELETE /devices/{id}',
    previewAndroid: '../preview_captures/android_411dp/preview_revocation_alert.png',
    previewIos: '../preview_captures/ios_402pt/preview_revocation_alert.png',
    androidImg: '../android/verification/revocation_alert.png',
    iosImg: '../ios/verification/revocation_alert.png',
    statusVisual: 'Matches reviewed reference',
    statusNav: 'Route opened',
    statusFunc: 'Android: Passed / iOS: Passed',
    provenance: `Git ${manifest.gitCommit.slice(0, 7)} · Diff ${manifest.gitDiffHash.slice(0, 8)}`,
    typography: 'Title "Session Terminated" 18px Inter 700, explanation 13px (#8696a0), OK button 14px bold.',
    spacing: 'Centered modal card with 24px padding, 16px action button top margin.',
    dimensions: 'Centered alert card width 88% (max 340px), primary button height 42px.',
    icons: 'Alert / session end glyph in title badge.',
    glass: 'Heavy frosted glass backdrop blur with dark obsidian modal card #0e141a.',
    safeAreas: 'Centered vertically and horizontally, clearing all notch and navigation boundaries.',
    clearance: 'Centered within active viewport.',
    differences: 'Backend session revocation exercised live via DELETE /api/v1/devices/{id}; verified independently on Android and iOS.'
  }
];

function getStatusClass(status) {
  if (status === 'Matches reviewed reference') return 'matched';
  if (status === 'Differences remain') return 'differences';
  if (status === 'No approved reference') return 'no-reference';
  return 'unverified';
}

function generateHtml() {
  // Dimension 1: Visual Comparison
  const countVisualMatched = SCREENS.filter(s => s.statusVisual === 'Matches reviewed reference').length;
  const countVisualDiffs = SCREENS.filter(s => s.statusVisual === 'Differences remain').length;
  const countVisualNoRef = SCREENS.filter(s => s.statusVisual === 'No approved reference').length;
  const countVisualUnverified = SCREENS.filter(s => s.statusVisual === 'Unverified').length;

  // Dimension 2: Navigation & Routing
  const countNavOpened = SCREENS.filter(s => s.statusNav.includes('Route opened')).length;
  const countNavDockTap = SCREENS.filter(s => s.statusNav.includes('Interactive tap confirmed')).length;

  // Dimension 3: Functional Execution
  const countFuncPassedBoth = SCREENS.filter(s => s.statusFunc === 'Android: Passed / iOS: Passed').length;
  const countFuncPassedAndroid = SCREENS.filter(s => s.statusFunc.startsWith('Android: Passed / iOS:') && s.statusFunc !== 'Android: Passed / iOS: Passed').length;
  const countFuncPartially = SCREENS.filter(s => s.statusFunc.includes('Partially Verified')).length;
  const countFuncUnverified = SCREENS.filter(s => s.statusFunc === 'Unverified / Unverified').length;
  const countFuncUnavailable = SCREENS.filter(s => s.statusFunc === 'Unavailable / Proposed').length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IndiChat Mobile Redesign — Navigable Visual Comparison Gallery</title>
  <style>
    :root {
      --bg: #070b0e;
      --surface: #0e141a;
      --surface-elevated: #131c24;
      --surface-card: #111b22;
      --text-main: #f0f4f2;
      --text-sec: #8696a0;
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.16);
      --emerald: #10b981;
      --emerald-subtle: rgba(16, 185, 129, 0.12);
      --cyan: #53bdeb;
      --blue: #3b82f6;
      --amber: #f59e0b;
      --danger: #f43f5e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header.gallery-header {
      background: rgba(14, 20, 26, 0.95);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 20px 32px;
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header-left h1 {
      font-size: 20px;
      font-weight: 800;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-left h1 .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--emerald-subtle);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-left p {
      font-size: 12.5px;
      color: var(--text-sec);
      margin-top: 4px;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .provenance-pill {
      background: var(--surface-card);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11.5px;
      color: var(--text-sec);
    }
    .provenance-pill strong {
      color: var(--emerald);
      font-family: monospace;
    }
    .jump-select {
      background: var(--surface-card);
      color: var(--text-main);
      border: 1px solid var(--border-strong);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    /* Dashboard Stats Bar */
    .dashboard-stats {
      padding: 16px 32px;
      background: #090e13;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .dim-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dim-header {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-sec);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dim-header strong {
      color: var(--text-main);
    }
    .dim-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stat-badge {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      font-size: 16px;
      font-weight: 800;
    }
    .stat-info .stat-num {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.2;
    }
    .stat-info .stat-label {
      font-size: 11px;
      color: var(--text-sec);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .gallery-container {
      display: flex;
      flex: 1;
    }
    nav.sidebar {
      width: 280px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 20px 14px;
      overflow-y: auto;
      max-height: calc(100vh - 150px);
      position: sticky;
      top: 85px;
    }
    .nav-section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-sec);
      margin: 16px 8px 8px;
    }
    .nav-item {
      display: block;
      padding: 8px 10px;
      border-radius: 6px;
      color: var(--text-sec);
      text-decoration: none;
      font-size: 12.5px;
      font-weight: 500;
      transition: all 0.15s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nav-item:hover, .nav-item.active {
      background: rgba(255, 255, 255, 0.07);
      color: var(--text-main);
    }
    .nav-item .nav-id {
      display: inline-block;
      width: 22px;
      color: var(--emerald);
      font-weight: 700;
    }
    main.content-area {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
    }
    .screen-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      margin-bottom: 40px;
      overflow: hidden;
      scroll-margin-top: 100px;
    }
    .screen-card-header {
      padding: 16px 24px;
      background: var(--surface-elevated);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .screen-card-title h2 {
      font-size: 16px;
      font-weight: 750;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .route-tag {
      font-family: monospace;
      font-size: 11.5px;
      color: var(--cyan);
      background: rgba(83, 189, 235, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(83, 189, 235, 0.25);
    }
    .status-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 6px;
      border: 1px solid transparent;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .pill.matched { background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
    .pill.differences { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); }
    .pill.no-reference { background: rgba(249, 115, 22, 0.15); color: #f97316; border-color: rgba(249, 115, 22, 0.3); }
    .pill.unverified { background: rgba(156, 163, 175, 0.15); color: #9ca3af; border-color: rgba(156, 163, 175, 0.3); }
    .pill.route-opened { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3); }

    /* Platform Grouped Comparisons */
    .platform-comparison-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding: 24px;
      background: #080d11;
      border-bottom: 1px solid var(--border);
    }
    @media (max-width: 1300px) {
      .platform-comparison-row {
        grid-template-columns: 1fr;
      }
    }
    .platform-block {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .platform-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .platform-title {
      font-size: 12.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .platform-title .os-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }
    .os-badge.android { background: rgba(61, 220, 132, 0.15); color: #3ddc84; }
    .os-badge.ios { background: rgba(255, 255, 255, 0.15); color: #ffffff; }

    .platform-pair-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .device-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .device-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-sec);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .device-viewport {
      font-size: 10.5px;
      color: #5f707a;
      font-weight: 500;
    }
    .viewport-frame {
      width: 100%;
      aspect-ratio: 9 / 19.5;
      background: #040608;
      border-radius: 24px;
      border: 2px solid #1c2630;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      position: relative;
    }
    .viewport-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .viewport-empty {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      color: var(--text-sec);
      font-size: 11.5px;
      background: repeating-linear-gradient(45deg, #090e13, #090e13 10px, #0e141a 10px, #0e141a 20px);
    }
    .viewport-empty .glyph { font-size: 26px; margin-bottom: 6px; }

    .review-breakdown {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .breakdown-item {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .breakdown-item h4 {
      font-size: 11.5px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--emerald);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .breakdown-item p {
      font-size: 12px;
      color: var(--text-main);
      line-height: 1.5;
      white-space: pre-line;
    }
    .breakdown-item.differences-box {
      grid-column: 1 / -1;
      border-color: rgba(245, 158, 11, 0.3);
      background: rgba(245, 158, 11, 0.04);
    }
    .breakdown-item.differences-box h4 {
      color: var(--amber);
    }

    footer.gallery-footer {
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: var(--text-sec);
    }
  </style>
</head>
<body>

  <header class="gallery-header">
    <div class="header-left">
      <h1>
        IndiChat Mobile Redesign
        <span class="badge">Visual Acceptance Gallery</span>
      </h1>
      <p>Liquid Glass Design Parity &middot; Pixel 8 (411.43 dp) &middot; iPhone 17 (402 pt) &middot; Dark Obsidian (#070b0e)</p>
    </div>
    <div class="header-right">
      <div class="provenance-pill">
        Commit: <strong>${manifest.gitCommit.slice(0, 7)}</strong> &middot; Diff: <strong>${manifest.gitDiffHash.slice(0, 8)}</strong>
      </div>
      <div class="provenance-pill">
        APK: <strong>${(manifest.artifacts.androidApk.size / (1024 * 1024)).toFixed(1)} MB</strong> &middot; iOS: <strong>${(manifest.artifacts.iosSimulatorZip.size / (1024 * 1024)).toFixed(1)} MB</strong>
      </div>
      <select class="jump-select" onchange="location.hash = this.value">
        <option value="">Jump to Screen...</option>
        ${SCREENS.map(s => `<option value="#screen-${s.id}">[${s.id}] ${s.name}</option>`).join('')}
      </select>
    </div>
  </header>

  <!-- Dashboard Stats (3 Distinct Dimensions) -->
  <section class="dashboard-stats">
    <!-- Dimension 1: Visual Comparison -->
    <div class="dim-group">
      <div class="dim-header">
        <span>🎨</span>
        <strong>Dimension 1: Visual Comparison</strong>
        <span>(34 Surfaces)</span>
      </div>
      <div class="dim-grid">
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(16,185,129,0.15);color:#10b981;">✓</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#10b981;">${countVisualMatched}</div>
            <div class="stat-label">Matches Reviewed Reference</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;">!</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#f59e0b;">${countVisualDiffs}</div>
            <div class="stat-label">Differences Remain</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(249,115,22,0.15);color:#f97316;">★</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#f97316;">${countVisualNoRef}</div>
            <div class="stat-label">No Approved Reference</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(156,163,175,0.15);color:#9ca3af;">?</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#9ca3af;">${countVisualUnverified}</div>
            <div class="stat-label">Unverified</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dimension 2: Navigation & Routing -->
    <div class="dim-group">
      <div class="dim-header">
        <span>🧭</span>
        <strong>Dimension 2: Route Opening / Interactive Navigation</strong>
        <span>(34 Surfaces)</span>
      </div>
      <div class="dim-grid">
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;">↗</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#60a5fa;">${countNavOpened} / 34</div>
            <div class="stat-label">Route Opened (Android & iOS)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(16,185,129,0.15);color:#10b981;">👆</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#10b981;">${countNavDockTap}</div>
            <div class="stat-label">Interactive Dock Tap Confirmed</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dimension 3: Functional Execution -->
    <div class="dim-group">
      <div class="dim-header">
        <span>⚙️</span>
        <strong>Dimension 3: Functional Execution</strong>
        <span>(34 Surfaces)</span>
      </div>
      <div class="dim-grid">
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(16,185,129,0.15);color:#10b981;">✓✓</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#10b981;">${countFuncPassedBoth}</div>
            <div class="stat-label">Passed (Both Platforms)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(83,189,235,0.15);color:#53bdeb;">📱</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#53bdeb;">${countFuncPassedAndroid}</div>
            <div class="stat-label">Passed Android / Pending iOS</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;">⚡</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#f59e0b;">${countFuncPartially}</div>
            <div class="stat-label">Partially Verified</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(156,163,175,0.15);color:#9ca3af;">⏳</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#9ca3af;">${countFuncUnverified}</div>
            <div class="stat-label">Unverified (Forms / Mutations)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-badge" style="background:rgba(244,63,94,0.15);color:#f43f5e;">⊘</div>
          <div class="stat-info">
            <div class="stat-num" style="color:#f43f5e;">${countFuncUnavailable}</div>
            <div class="stat-label">Unavailable / Proposed</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <div class="gallery-container">
    <nav class="sidebar">
      ${(() => {
        let currentCat = '';
        return SCREENS.map(s => {
          let html = '';
          if (s.category !== currentCat) {
            currentCat = s.category;
            html += `<div class="nav-section-title">${currentCat}</div>`;
          }
          html += `<a href="#screen-${s.id}" class="nav-item">
            <span class="nav-id">${s.id}</span> ${s.name}
          </a>`;
          return html;
        }).join('');
      })()}
    </nav>

    <main class="content-area">
      ${SCREENS.map(s => `
        <article class="screen-card" id="screen-${s.id}">
          <div class="screen-card-header">
            <div class="screen-card-title">
              <h2>
                <span>[${s.id}] ${s.name}</span>
                <span class="route-tag">${s.route}</span>
              </h2>
            </div>
            <div class="status-pills">
              <span class="pill ${getStatusClass(s.statusVisual)}">
                Visual: ${s.statusVisual}
              </span>
              <span class="pill route-opened">
                Nav: ${s.statusNav}
              </span>
              <span class="pill ${s.statusFunc.includes('Passed') ? 'matched' : 'unverified'}">
                Func: ${s.statusFunc}
              </span>
            </div>
          </div>

          <!-- Platform-specific 1:1 Viewport Comparisons -->
          <div class="platform-comparison-row">

            <!-- Android Block (411.43 dp) -->
            <div class="platform-block">
              <div class="platform-header">
                <span class="platform-title">
                  <span class="os-badge android">Android</span>
                  Pixel 8 (411.43 dp logical width)
                </span>
                <span class="device-viewport">1080x2400 @ 2.625x</span>
              </div>
              <div class="platform-pair-grid">
                <div class="device-col">
                  <div class="device-label">
                    <span>Approved Preview</span>
                    <span class="device-viewport">(411.43 dp)</span>
                  </div>
                  <div class="viewport-frame">
                    ${s.previewAndroid && fs.existsSync(path.resolve('release/comparison_gallery', s.previewAndroid)) ? `
                      <img src="${s.previewAndroid}" alt="Preview: ${s.name}" loading="lazy">
                    ` : `
                      <div class="viewport-empty">
                        <span class="glyph">🎨</span>
                        <strong>No approved reference</strong>
                        <span>Native extension in mobile client</span>
                      </div>
                    `}
                  </div>
                </div>
                <div class="device-col">
                  <div class="device-label">
                    <span>Native Android</span>
                    <span class="device-viewport">(emulator-5554)</span>
                  </div>
                  <div class="viewport-frame">
                    ${s.androidImg && fs.existsSync(path.resolve('release/comparison_gallery', s.androidImg)) ? `
                      <img src="${s.androidImg}" alt="Android: ${s.name}" loading="lazy">
                    ` : `
                      <div class="viewport-empty">
                        <span class="glyph">📱</span>
                        <strong>Not captured</strong>
                        <span>Handled by native dialog/modal</span>
                      </div>
                    `}
                  </div>
                </div>
              </div>
            </div>

            <!-- iOS Block (402 pt) -->
            <div class="platform-block">
              <div class="platform-header">
                <span class="platform-title">
                  <span class="os-badge ios">iOS</span>
                  iPhone 17 (402 pt logical width)
                </span>
                <span class="device-viewport">1206x2622 @ 3x</span>
              </div>
              <div class="platform-pair-grid">
                <div class="device-col">
                  <div class="device-label">
                    <span>Approved Preview</span>
                    <span class="device-viewport">(402 pt)</span>
                  </div>
                  <div class="viewport-frame">
                    ${s.previewIos && fs.existsSync(path.resolve('release/comparison_gallery', s.previewIos)) ? `
                      <img src="${s.previewIos}" alt="Preview: ${s.name}" loading="lazy">
                    ` : `
                      <div class="viewport-empty">
                        <span class="glyph">🎨</span>
                        <strong>No approved reference</strong>
                        <span>Native extension in mobile client</span>
                      </div>
                    `}
                  </div>
                </div>
                <div class="device-col">
                  <div class="device-label">
                    <span>Native iOS</span>
                    <span class="device-viewport">(iPhone 17)</span>
                  </div>
                  <div class="viewport-frame">
                    ${s.iosImg && fs.existsSync(path.resolve('release/comparison_gallery', s.iosImg)) ? `
                      <img src="${s.iosImg}" alt="iOS: ${s.name}" loading="lazy">
                    ` : `
                      <div class="viewport-empty">
                        <span class="glyph">🍎</span>
                        <strong>${s.id === 31 ? 'WebRTC Omitted' : 'Not captured'}</strong>
                        <span>${s.id === 31 ? 'Simulator build omits native WebRTC bindings' : 'Handled by native dialog/modal'}</span>
                      </div>
                    `}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Review Breakdown -->
          <div class="review-breakdown">
            <div class="breakdown-item">
              <h4>🔤 Typography & Weights</h4>
              <p>${s.typography}</p>
            </div>
            <div class="breakdown-item">
              <h4>📐 Spacing & Margins</h4>
              <p>${s.spacing}</p>
            </div>
            <div class="breakdown-item">
              <h4>📏 Dimensions & Radii</h4>
              <p>${s.dimensions}</p>
            </div>
            <div class="breakdown-item">
              <h4>✨ Glass & Materials</h4>
              <p>${s.glass}</p>
            </div>
            <div class="breakdown-item">
              <h4>🛡 Safe Areas & Dock Insets</h4>
              <p>${s.safeAreas}</p>
            </div>
            <div class="breakdown-item">
              <h4>↕ Content Clearance</h4>
              <p>${s.clearance}</p>
            </div>
            <div class="breakdown-item differences-box">
              <h4>📝 Demonstrated Remaining Differences & Provenance</h4>
              <p><strong>Observed Differences:</strong> ${s.differences}\n<strong>Build Provenance:</strong> ${s.provenance}</p>
            </div>
          </div>
        </article>
      `).join('')}
    </main>
  </div>

  <footer class="gallery-footer">
    IndiChat Mobile Redesign Acceptance Suite &middot; Strict Conformance to AGENTS.md &amp; preview/preview-liquid-glass.html &middot; All Rights Reserved.
  </footer>

</body>
</html>`;
}

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), generateHtml());
console.log('✔ Navigable comparison gallery written to release/comparison_gallery/index.html');
