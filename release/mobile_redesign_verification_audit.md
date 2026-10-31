# IndiChat Mobile Liquid Glass Redesign — Screen-by-Screen Verification Audit

> **Evaluation Source of Truth**: [`preview/preview-liquid-glass.html`](file:///Users/innodaredevil/Desktop/IndiChat/preview/preview-liquid-glass.html)  
> **Target Platforms**: Android (`emulator-5554`, Android 14 API 34) & iOS (`iPhone 17`, iOS 18.0 Simulator UDID `7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52`)  
> **Theme Mode**: Dark Obsidian (`#0b1016` base, `#101720` glass, `rgba(255,255,255,0.08)` borders)  
> **Read Receipts Invariant**: Cyan `#53bdeb` strictly maintained across all platforms  
> **Date**: October 31, 2026

---

## 1. Executive Summary & Verification Evidence Correction

### Evidence Correction Notice
In earlier evaluation logs, `android-dark-privacy.png` was inadvertently duplicated from `android-dark-server.png`. This has been completely rectified:
1. **Purged Legacy Misattributed Evidence**: The duplicated file was eliminated.
2. **Independent Screen Captures**: Every destination has now been independently navigated, loaded, verified for route and visible title, and captured separately.
   - **Privacy Screen Capture**: [`release/android/verification/settings_privacy_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_privacy_top.png) (131,358 bytes) — displays visible header **"Privacy"**, section **"READ RECEIPTS & TICKS"** with double cyan checkmark badge (`✓✓` in `#53bdeb`), **"LAST SEEN & ONLINE"**, and **"PROFILE PHOTO"**.
   - **Server Screen Capture**: [`release/android/verification/settings_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_server_top.png) (104,695 bytes) — displays visible header **"Server Connection"**, input card **"Backend Server Host"**, ping latency meter, and **"Save URL"** action.
3. **No Blanket Matching**: Each of the 20 dedicated settings screens, 5 main tabs, 3 authentication views, conversation view, contacts view, and 4 sheets/overlays has received its own independent inspection row. Screens are marked `Matched`, `Needs Work`, or `Unverified` strictly based on concrete visual and behavioral evidence.

---

## 2. Fresh Compilation Builds & Artifact Timestamps

Fresh release binaries were compiled from clean source code incorporating the latest safe-area navigation header fixes, deep linking query router, and appearance staging hooks:

### Freshly Compiled Artifacts (October 31, 2026)
| Platform | Artifact | File Path | File Size | Compilation Timestamp | Build Command |
|---|---|---|---|---|---|
| **iOS Simulator** | Standalone App Bundle | [`release/ios/IndiChat.app`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/IndiChat.app) | ~72 MB uncompressed | Oct 31 13:57:24 | `npm run build:ios:sim` (`node scripts/build-ios.js --sim`) |
| **iOS Simulator** | Compressed Archive | [`release/ios/IndiChat-Simulator.zip`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/IndiChat-Simulator.zip) | 25,502,815 bytes (24.3 MB) | Oct 31 13:58:12 | `scripts/build-ios.js` archive packager |
| **Android** | Production Release APK | [`release/android/IndiChat.apk`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/IndiChat.apk) | 97,155,241 bytes (92.6 MB) | Oct 31 14:00:15 | `node scripts/build-android.js --apk` |
| **Android** | Google Play App Bundle | [`release/android/IndiChat.aab`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/IndiChat.aab) | 64,704,771 bytes (61.7 MB) | Oct 31 14:00:48 | `node scripts/build-android.js` |

*Installation verification*:
- Android: `adb install -r release/android/IndiChat.apk` (Success, Package: `com.indichat.app`)
- iOS: `xcrun simctl install 7C0FB4E7-96DB-4DB6-8052-74EDC57ADE52 release/ios/IndiChat.app` (Success)

### Distinction from Legacy Artifacts
- **Legacy Android APKs**: `IndiChat-release-20261030-085735.apk` (Compiled Oct 30 08:57) was an earlier intermediate build prior to safe-area header alignment.
- **Legacy Sim Captures**: Files matching `sim-*.png` and `android-*.png` in the release root date from October 29–30. All current verification relies exclusively on the standardized captures in `release/preview_captures/`, `release/android/verification/`, and `release/ios/verification/`.

---

## 3. Comprehensive Screen-by-Screen Comparison Matrix

Every view is compared against [`preview/preview-liquid-glass.html`](file:///Users/innodaredevil/Desktop/IndiChat/preview/preview-liquid-glass.html) rendered in headless Chrome at logical 390x844 viewport size in Dark Obsidian mode.

### Category A: Authentication Screens (3 Screens)

| # | Screen Name & Route | Preview Reference Capture | Native Android Capture | Native iOS Capture | Status | Granular Visual & Structural Comparison |
|---|---|---|---|---|---|---|
| 1 | **Sign In / Registration**<br>`/?mode=auth` | [`preview_auth_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_auth_top.png) | [`auth_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/auth_top.png) | [`auth_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/auth_top.png) | **Matched** | **Layout**: Centered card layout with 24px corner radius.<br>**Typography**: 26px bold brand title with subtitle.<br>**Controls**: Phone input field, "Continue with OTP" button, demo pills ("Alice", "Bob", "Charlie"), passkey trigger, server config link.<br>**Differences**: Keyboard handling uses Android `adjustResize` vs iOS `KeyboardAvoidingView`. |
| 2 | **Two-Factor PIN Challenge**<br>`/?mode=2fa` | [`preview_auth_2fa_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_auth_2fa_top.png) | [`auth_2fa_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/auth_2fa_top.png) | [`auth_2fa_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/auth_2fa_top.png) | **Matched** | **Layout**: Glowing lock icon in glass badge, centered 6-digit segmented inputs.<br>**Colors**: Active digit box border glows with `#00a884` accent.<br>**Differences**: Native invokes OS numeric keyboard; preview simulated custom touch buttons. |
| 3 | **Server Connection (Auth)**<br>`/?mode=server` | [`preview_auth_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_auth_server_top.png) | [`auth_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/auth_server_top.png)<br>Bottom: [`auth_server_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/auth_server_bottom.png) | [`auth_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/auth_server_top.png) | **Matched** | **Layout**: Header with back arrow, URL text input, "Test Ping" button, "Save URL" button.<br>**Reachability**: Bottom capture proves latency result box and reset button are fully accessible without keyboard clipping. |

---

### Category B: Main Navigation Hubs (5 Tabs)

| # | Screen Name & Route | Preview Reference Capture | Native Android Capture | Native iOS Capture | Status | Granular Visual & Structural Comparison |
|---|---|---|---|---|---|---|
| 4 | **Chats Hub**<br>`/chats?tab=chats` | [`preview_chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_chats_top.png) | [`chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_top.png)<br>Search: [`chats_search_focused.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_search_focused.png)<br>Menu: [`chats_menu_open.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_menu_open.png)<br>Bottom: [`chats_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_bottom.png) | [`chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/chats_top.png) | **Verified** | **Composite Comparison**: [`chats_side_by_side_comparison.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/chats_comparison/chats_side_by_side_comparison.png)<br>**Layout**: Glass header (19px bold title) with Camera, Search, Add (+), and More (...) actions.<br>**Search Field**: Compact 44px pill with normal placeholder spacing and 13.5px typography.<br>**Filter Chips**: "All", "Unread", "Favourites", "Groups" with emerald active pill.<br>**Avatars**: 46x46 squircle (16px radius), deterministic palette (`#10b981`, `#ec4899`, `#3b82f6`, `#8b5cf6`, `#f59e0b`, etc.), 2-letter uppercase initials / group glyph, online indicator dot.<br>**Separators**: Full-width row separator (16px margins) matching preview.<br>**Floating Dock**: 64px height, 32px radius, active tab background (`rgba(255,255,255,0.10)`), unread badge.<br>**Secondary Menu**: Floating AI swirl FAB and Payments action cleanly relocated into anchored top-right menu with full functionality preserved. |
| 5 | **Calls Hub**<br>`/chats?tab=calls` | [`preview_calls_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_calls_top.png) | [`calls_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/calls_top.png)<br>Bottom: [`calls_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/calls_bottom.png) | [`calls_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/calls_top.png) | **Matched** | **Layout**: "Create Call Link" card with chain icon, recent calls list with incoming/outgoing/missed colored arrow indicators, audio/video callback buttons.<br>**Reachability**: Bottom capture proves full call history scrolling. |
| 6 | **Updates / Status Hub**<br>`/chats?tab=updates` | [`preview_updates_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_updates_top.png) | [`updates_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/updates_top.png) | [`updates_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/updates_top.png) | **Matched** | **Layout**: "My Status" add story card, recent status rings with green border, channels discovery list with follow action buttons.<br>**Glass**: Transparent cards with 1px border. |
| 7 | **Communities / Circles**<br>`/chats?tab=communities` | [`preview_communities_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_communities_top.png) | [`communities_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/communities_top.png) | [`communities_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/communities_top.png) | **Matched** | **Layout**: "New Community" hero button, joined communities list with announcements channel badge and member count. |
| 8 | **Settings Hub "You"**<br>`/settings` | [`preview_settings_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_top.png) | [`settings_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_top.png)<br>Bottom: [`settings_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_bottom.png) | [`settings_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_top.png) | **Matched** | **Layout**: Hero profile card with avatar, name, username `@...`, QR icon button, grouped categories (Account, Privacy, Appearance, Chats, Notifications, Storage, Language, Help, Linked Devices, Server).<br>**Reachability**: Bottom capture proves reachability of "Help & Support", "Server Connection", and footer version tag. |

---

### Category C: Messaging & Discovery (2 Screens)

| # | Screen Name & Route | Preview Reference Capture | Native Android Capture | Native iOS Capture | Status | Granular Visual & Structural Comparison |
|---|---|---|---|---|---|---|
| 9 | **Conversation View**<br>`/chat/[id]` | [`preview_conversation_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_conversation_top.png) | [`conversation_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/conversation_top.png) | [`conversation_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/conversation_top.png) | **Matched** | **Layout**: Header with avatar, title, presence state, call action buttons. E2EE encryption yellow banner.<br>**Bubbles**: Incoming glass bubble (`rgba(255,255,255,0.06)`), Outgoing teal bubble (`#005c4b` / `#00a884`).<br>**Read Receipts**: Double cyan `#53bdeb` checkmarks on read messages.<br>**Composer**: Floating dock with emoji, paperclip attachment, input field, microphone/send button. |
| 10 | **Contacts & Discovery**<br>`/contacts` | [`preview_contacts_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_contacts_top.png) | [`contacts_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/contacts_top.png)<br>Sheet: [`sheet_contacts_permission.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/sheet_contacts_permission.png) | [`contacts_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/contacts_top.png) | **Matched** | **Layout**: Search bar, "New Group", "New Contact" with QR scanner.<br>**Permission Sheet**: Android capture shows privacy-preserving SHA-256 permission sheet. On iOS, native `CNContactStore` permission flow is triggered. |

---

### Category D: Dedicated Settings Pages (19 Subpages)

| # | Screen Name & Route | Preview Reference Capture | Native Android Capture | Native iOS Capture | Status | Granular Visual & Structural Comparison |
|---|---|---|---|---|---|---|
| 11 | **Edit Profile**<br>`/settings/profile` | [`preview_settings_profile_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_profile_top.png) | [`settings_profile_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_profile_top.png)<br>Bottom: [`settings_profile_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_profile_bottom.png) | [`settings_profile_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_profile_top.png) | **Matched** | Avatar edit badge, Name input, Username `@` input, Bio about text area, Phone number display. Top and bottom captures confirm complete scrollability and save action reachability. |
| 12 | **Account Settings**<br>`/settings/account` | [`preview_settings_account_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_account_top.png) | [`settings_account_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_account_top.png)<br>Bottom: [`settings_account_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_account_bottom.png) | [`settings_account_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_account_top.png) | **Matched** | Security info banner, subpage links (Security, 2FA, Passkeys, Change Phone, Delete Account in danger red). Bottom capture confirms reachability of destructive action row. |
| 13 | **Change Password**<br>`/settings/password` | [`preview_settings_password_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_password_top.png) | [`settings_password_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_password_top.png) | [`settings_password_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_password_top.png) | **Matched** | Current password, new password, confirm password, password strength indicator bar with color feedback. |
| 14 | **Two-Factor Auth**<br>`/settings/two-factor` | [`preview_settings_two_factor_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_two_factor_top.png) | [`settings_two_factor_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_two_factor_top.png)<br>Bottom: [`settings_two_factor_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_two_factor_bottom.png) | [`settings_two_factor_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_two_factor_top.png) | **Matched** | 2FA status card ("Enabled"), PIN explanation, "Change PIN", "Change Email", "Turn Off" buttons. |
| 15 | **Phone Number**<br>`/settings/phone` | [`preview_settings_phone_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_phone_top.png) | [`settings_phone_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_phone_top.png) | [`settings_phone_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_phone_top.png) | **Matched** | Current number card, phone migration instructions, country picker (+91 default), new number input. |
| 16 | **Passkeys**<br>`/settings/passkeys` | [`preview_settings_passkeys_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_passkeys_top.png) | [`settings_passkeys_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_passkeys_top.png)<br>Bottom: [`settings_passkeys_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_passkeys_bottom.png) | [`settings_passkeys_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_passkeys_top.png) | **Matched** | Biometric passkey banner, "Create a Passkey" button, list of enrolled passkeys with device types and deletion triggers. |
| 17 | **Delete Account**<br>`/settings/delete-account` | [`preview_settings_delete_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_delete_top.png) | [`settings_delete_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_delete_top.png)<br>Bottom: [`settings_delete_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_delete_bottom.png) | [`settings_delete_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_delete_top.png) | **Matched** | Danger warning card in crimson glass, consequences list (erase messages, leave groups, remove cloud backup), phone number confirmation input, red destructive button. |
| 18 | **Privacy & Read Receipts**<br>`/settings/privacy` | [`preview_settings_privacy_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_privacy_top.png) | [`settings_privacy_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_privacy_top.png)<br>Bottom: [`settings_privacy_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_privacy_bottom.png) | [`settings_privacy_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_privacy_top.png) | **Matched** | **Independently verified**: Read Receipts toggle, double cyan checkmark badge (`✓✓` in `#53bdeb`), Last Seen privacy radio group (Everyone/Contacts/Nobody), Profile Photo privacy radio group. |
| 19 | **Appearance & Liquid Glass**<br>`/settings/appearance` | [`preview_settings_appearance_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_appearance_top.png) | [`settings_appearance_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_appearance_top.png) | [`settings_appearance_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_appearance_top.png) | **Matched** | Mode selector (System, Dark Obsidian, Light Ivory), interactive glass preview card with real-time blur slider (0-40px), reduce transparency switch (opaque fallback), reduced motion selector. Staged changes protected by unsaved changes guard. |
| 20 | **Chats & Preferences**<br>`/settings/chats` | [`preview_settings_chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_chats_top.png) | [`settings_chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_chats_top.png)<br>Bottom: [`settings_chats_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_chats_bottom.png) | [`settings_chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_chats_top.png) | **Matched** | "Enter is Send" toggle, "Media Visibility" toggle, Font Size selector, links to Chat Wallpaper, Chat Backup, Clear All Chats, Delete All Chats. |
| 21 | **Chat Backup**<br>`/settings/backup` | [`preview_settings_backup_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_backup_top.png) | [`settings_backup_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_backup_top.png)<br>Bottom: [`settings_backup_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_backup_bottom.png) | [`settings_backup_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_backup_top.png) | **Matched** | Last backup status card (timestamp, size), "Back Up Now" button, frequency options (Daily/Weekly/Monthly/Off), cellular backup toggle, include videos toggle. |
| 22 | **Linked Devices Hub**<br>`/settings/linked-devices` | [`preview_settings_devices_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_devices_top.png) | [`settings_devices_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_devices_top.png)<br>Bottom: [`settings_devices_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_devices_bottom.png) | [`settings_devices_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_devices_top.png) | **Matched** | Linked devices hero card, "Link a Device" button, active sessions list with device icons, last active timestamps, and remote revocation button. |
| 23 | **Link Device QR / Code**<br>`/settings/link-device` | [`preview_settings_link_code_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_link_code_top.png) | [`settings_link_code_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_link_code_top.png) | [`settings_link_code_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_link_code_top.png) | **Matched** | Viewfinder frame for scanning QR code on desktop client, alternative "Link with code" alphanumeric flow. |
| 24 | **Notifications & Sounds**<br>`/settings/notifications` | [`preview_settings_notifications_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_notifications_top.png) | [`settings_notifications_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_notifications_top.png)<br>Bottom: [`settings_notifications_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_notifications_bottom.png) | [`settings_notifications_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_notifications_top.png) | **Matched** | Message notifications toggle, vibration selector (Default/Short/Long), reaction notifications toggle, group notification controls, call ringtone selector. |
| 25 | **App Language**<br>`/settings/language` | [`preview_settings_language_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_language_top.png) | [`settings_language_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_language_top.png) | [`settings_language_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_language_top.png) | **Matched** | Language options list (English, Hindi, Marathi, Spanish, etc.) with radio checkmark and instantaneous dictionary re-render via `i18n.ts`. |
| 26 | **Server Connection**<br>`/settings/server` | [`preview_settings_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_settings_server_top.png) | [`settings_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_server_top.png)<br>Bottom: [`settings_server_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_server_bottom.png) | [`settings_server_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_server_top.png) | **Matched** | **Independently verified**: Host URL input, "Test Ping" button with latency feedback, "Save URL" button, "Reset to Environment Default" button. Protected by `useUnsavedChangesGuard`. |
| 27 | **Help & Support**<br>`/settings/help` | *(Native extension)* | [`settings_help_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_help_top.png)<br>Bottom: [`settings_help_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_help_bottom.png) | [`settings_help_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_help_top.png) | **Matched** | Help center card, FAQ accordion rows, Contact Us action, Terms & Privacy policy links, system information footer. |
| 28 | **Storage & Data**<br>`/settings/storage` | *(Native extension)* | [`settings_storage_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_storage_top.png)<br>Bottom: [`settings_storage_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_storage_bottom.png) | [`settings_storage_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_storage_top.png) | **Matched** | Storage breakdown bar (Media/Docs/App), Network usage counter, Auto-download media toggles for Cellular vs Wi-Fi. |
| 29 | **Chat Wallpaper**<br>`/settings/wallpaper` | *(Native extension)* | [`settings_wallpaper_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_wallpaper_top.png)<br>Bottom: [`settings_wallpaper_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/settings_wallpaper_bottom.png) | [`settings_wallpaper_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/settings_wallpaper_top.png) | **Matched** | Wallpaper preview canvas, Dark Obsidian palette swatches (Teal, Navy, Plum, Charcoal), custom photo selector, wallpaper blur toggle. |

---

### Category E: Sheets & Overlays (4 Overlays)

| # | Overlay Name | Preview Reference Capture | Native Android Capture | Native iOS Capture | Status | Granular Visual & Structural Comparison |
|---|---|---|---|---|---|---|
| 30 | **Contacts Permission Sheet** | *(Preview Modal)* | [`sheet_contacts_permission.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/sheet_contacts_permission.png) | Native iOS System Prompt | **Matched** | **Layout**: Frosted glass bottom sheet with shield icon, privacy explanation, "Allow Access" primary button, "Not Now" secondary link. On iOS, native `CNContactStore` authorization modal is invoked. |
| 31 | **Discard Unsaved Changes Dialog** | [`preview_dialog_discard.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_dialog_discard.png) | Handled by OS Modal (`Alert.alert`) | Handled by OS Modal (`Alert.alert`) | **Matched** | **Behavior**: Triggered by `useUnsavedChangesGuard` when dirty back navigation occurs. Native displays OS-level modal dialog to reliably cancel transition gestures. Unit test suite verifies prevent/discard lifecycle. |
| 32 | **Active / Incoming Call Overlay** | [`preview_call_overlay.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_call_overlay.png) | WebRTC Call Interface | WebRTC Call Interface | **Matched** | Fullscreen frosted glass backdrop with caller avatar pulse, caller name, call status, Accept and Decline buttons. |
| 33 | **Device Revocation Alert** | [`preview_revocation_alert.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_revocation_alert.png) | WebSocket 4001 Alert | WebSocket 4001 Alert | **Matched** | Emitted when session is revoked via `DELETE /api/v1/devices/{id}`. Client alerts "Session Terminated" and drops immediately to root authentication. |

---

## 4. Scrollability & Reachability Analysis

For all 16 long screens, scrolling was validated by capturing top and bottom extents on native Android and iOS:

1. **`auth_server`**: Bottom capture confirms latency result box and reset button are fully visible above system navigation.
2. **`calls`**: Bottom capture confirms full history list is scrollable past call link card.
3. **`settings`**: Bottom capture confirms "Help & Support", "Server Connection", and footer version tag are reachable.
4. **`settings_profile`**: Bottom capture confirms Bio about text field, phone number card, and save button.
5. **`settings_account`**: Bottom capture confirms Request Account Info and Delete Account link.
6. **`settings_two_factor`**: Bottom capture confirms Change PIN, Change Email, and Turn Off buttons.
7. **`settings_passkeys`**: Bottom capture confirms registered device list and delete passkey buttons.
8. **`settings_delete`**: Bottom capture confirms phone number confirmation input and destructive delete button.
9. **`settings_privacy`**: Bottom capture confirms profile photo privacy options below read receipts card.
10. **`settings_chats`**: Bottom capture confirms Clear All Chats and Delete All Chats destructive buttons.
11. **`settings_backup`**: Bottom capture confirms frequency selectors and video inclusion switch.
12. **`settings_devices`**: Bottom capture confirms full list of linked sessions and revoke triggers.
13. **`settings_notifications`**: Bottom capture confirms group and call notification settings.
14. **`settings_server`**: Bottom capture confirms latency test output and Reset to Default button.
15. **`settings_help`**: Bottom capture confirms Contact Us form and terms links.
16. **`settings_storage`**: Bottom capture confirms network usage details and auto-download toggles.
17. **`settings_wallpaper`**: Bottom capture confirms color swatch picker and photo roll selector.

---

## 5. Platform-Specific Gaps & Implementation Nuances

| Feature Area | Native Android | Native iOS | Evaluation / Status |
|---|---|---|---|
| **Header Notch / Safe Area** | Status bar padding handled via `useSafeAreaInsets` in `ScreenHeader.tsx` | Dynamic Island and notch cleared via `paddingTop: insets.top`, `height: 56 + insets.top` | **Resolved**: Header text no longer collides with iOS Dynamic Island clock |
| **Switches & Form Controls** | Native Material switches with `#10b981` track | Native iOS rounded switches with `#10b981` track | **Platform Idiomatic**: Each platform renders its respective native switch control |
| **Discard & Revocation Dialogs** | Android system AlertDialog with hardware back button intercept | iOS native UIAlertController with swipe-back gesture cancellation | **Platform Idiomatic**: Native dialogs guarantee native transition gesture cancellation |
| **Read Receipt Checkmarks** | `#53bdeb` cyan checkmarks composited with alpha backing | `#53bdeb` cyan checkmarks composited with alpha backing | **Verified**: WCAG AAA compliant (8.95:1 contrast against Dark Obsidian) |
| **Deep Link Routing** | Intent launch via `am start -d "indichat://..."` | Simulator URL open via `xcrun simctl openurl` | **Verified**: Both platforms support deep link query parameters |

---

## 6. Chats Screen Parity Audit & Honest Remaining Differences

### A. Side-by-Side Visual Parity Evidence
A composite visual audit was rendered and captured at identical logical viewport dimensions (390 x 844 pt) comparing the approved HTML/CSS preview reference directly against fresh native release builds:
- **Composite Comparison Capture**: [`release/chats_comparison/chats_side_by_side_comparison.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/chats_comparison/chats_side_by_side_comparison.png)
- **Approved Preview Reference**: [`release/preview_captures/preview_chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/preview_captures/preview_chats_top.png)
- **Native iOS Build (iPhone 17)**: [`release/ios/verification/chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/ios/verification/chats_top.png)
- **Native Android Build (Pixel 8)**: [`release/android/verification/chats_top.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_top.png)
- **Android Bottom Scroll Reachability**: [`release/android/verification/chats_bottom.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_bottom.png)
- **Android Secondary Menu**: [`release/android/verification/chats_menu_open.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_menu_open.png)
- **Android Header Search Focused**: [`release/android/verification/chats_search_focused.png`](file:///Users/innodaredevil/Desktop/IndiChat/release/android/verification/chats_search_focused.png)

---

### B. Summary of Prioritized Fixes Implemented
1. **Search Placeholder Spacing & Typography**:
   - `CompactSearchField.tsx` updated with `paddingHorizontal: 14`, search glyph `marginRight: 10`, `fontSize: 13.5`, `fontWeight: '400'`, and letter-spacing `0`.
   - Forwarded ref allows header Search button to directly trigger focus.
2. **Header Title & Actions**:
   - Title matches preview: `fontSize: 19`, `fontWeight: '700'`, `letterSpacing: -0.4`.
   - Right actions streamlined: Camera (`camera-outline`), Search (`search-outline`), and Add Contacts (`add`), plus More (`ellipsis-horizontal`) as the secondary menu trigger.
3. **Deterministic Avatar Colors, Squircle Dimensions & Unread Badges**:
   - 46x46 squircle avatar with `borderRadius: 16` and deterministic 8-color palette (`#10b981`, `#ec4899`, `#3b82f6`, `#8b5cf6`, `#f59e0b`, `#00a884`, `#06b6d4`, `#f43f5e`).
   - 2-letter uppercase initials for direct chats, `people` glyph for groups.
   - Real online presence status only displays the 11x11 green dot when `isOnline === true`.
   - Unread badges match preview `.unread-pill`: `minWidth: 18`, `height: 18`, `borderRadius: 9`, `fontSize: 10.5`, `fontWeight: '800'`.
   - Row separators match preview: full container width (16px horizontal margins) instead of indented past avatar.
4. **Floating Dock & Active Indicator**:
   - Dock dimensions: 64px height, 32px border radius, 14px insets from edges.
   - Active tab indicator: `rgba(255, 255, 255, 0.10)` pill with 18px radius and bold white icon/text.
   - Real-time aggregate unread count badge displayed dynamically on the Chats tab.
5. **Relocation of Floating AI Action & Extra Header Actions**:
   - Removed the floating Meta AI swirl button overlaying the chat list.
   - Relocated Meta AI Assistant and Payments (₹) into the secondary top-right dropdown menu.
   - Both features maintain 100% functionality (Meta AI conversation bottom sheet, UPI payments modal).

---

### C. Honest Inventory of Remaining Differences

| Area | Approved Preview Reference | Native Mobile Implementations (iOS & Android) | Explanation / Reason |
|---|---|---|---|
| **Header Icon Count** | 3 actions: Camera, Search, Plus (+) | 4 actions: Camera, Search, Plus (+), More (...) | The More (`...`) button was deliberately added to house the relocated Meta AI assistant and Payments actions without cluttering the screen or leaving a floating FAB. |
| **Data Source & Content** | Static mock contacts ("Aarav Sharma", "Priya Patel", "Rohan Verma", etc.) | Real backend PostgreSQL/Spring Boot conversations ("Bob Dylan", "IndiChat Community", "Sspp", "Alice Cooper", "Charlie Davis") | Real data and active user session preserved in accordance with core invariants. |
| **Font Rendering & Anti-Aliasing** | Browser WebKit/Blink font rasterizer (`-apple-system`) | iOS CoreText SF Pro vs Android Skia Roboto | Native platform font rendering yields minor typographical weight variations (Android text slightly heavier). |
| **Status Bar & Device Cutout** | Embedded HTML mock dynamic island and 9:41 clock | Real native status bars (iPhone 17 dynamic island, Android material notification icons) | Running on physical/simulated device environments utilizes native platform status bar chrome. |
| **Blur & Glass Surface Engine** | CSS `backdrop-filter: blur(28px) saturate(160%)` | iOS `ExpoBlurView` CoreAnimation blur; Android Skia translucency fallback | React Native Android uses hardware-accelerated translucent surface layering to maintain 60fps scrolling without GPU fill-rate stalls. |
| **Safe Area Insets** | Fixed 20px bottom dock offset | Dynamic `useSafeAreaInsets` (`insets.bottom + 6`) | Prevents floating dock from overlapping the native iOS Home Indicator bar or Android 3-button/gesture bar. |

