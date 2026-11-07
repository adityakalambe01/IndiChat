/**
 * IndiChat Design Preview Studio — Deterministic Mock Fixtures (v2.0)
 * 
 * Provides rich, realistic data for:
 * - Conversations, Contacts & Groups
 * - Status Updates / Stories
 * - Call History & Dialer
 * - Starred Messages
 * - Emoji, GIF & Sticker Catalog
 * - Complete User Profile & Settings State
 * All data is strictly local, fictional, and client-side.
 */

window.INDICHAT_FIXTURES = (function() {
  'use strict';

  const DEFAULT_CONTACTS = [
    {
      id: 'c-aarav',
      name: 'Aarav Sharma',
      username: 'aarav_s',
      avatarColor: 'linear-gradient(135deg, #10b981, #00a884)',
      avatarInitials: 'AS',
      phoneNumber: '+91 98765 00112',
      bio: 'Senior UI Engineer · Designing IndiChat ✨',
      online: true,
      statusText: 'Online',
      lastSeen: 'Active now',
      unreadCount: 0,
      isGroup: false,
      pinned: true,
      starred: false,
      blocked: false,
      encryptionKey: '3842 9014 2855 0192 7831 6450 1198 4209',
      messages: [
        {
          id: 'm-a1',
          sender: 'them',
          senderDisplayName: 'Aarav Sharma',
          type: 'text',
          text: 'Hey! Are we ready to review the new IndiChat desktop & web design previews?',
          time: '09:20 AM',
          status: 'read',
          starred: false,
          reactions: { '👍': 1 }
        },
        {
          id: 'm-a2',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Yes! The responsive layout adapts seamlessly across Web, macOS, Linux, and Windows.',
          time: '09:22 AM',
          status: 'read',
          starred: true,
          reactions: { '❤️': 1 }
        },
        {
          id: 'm-a3',
          sender: 'them',
          senderDisplayName: 'Aarav Sharma',
          type: 'image',
          text: 'Here is the approved liquid glass color token palette for desktop glass surfaces 📐',
          imageTitle: 'IndiChat Desktop Glass Tokens',
          imageSubtitle: 'Restrained acrylic & blur variables (v2.4)',
          imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340"><rect width="600" height="340" fill="%230f1d24"/><circle cx="150" cy="120" r="80" fill="%2300a884" opacity="0.45"/><circle cx="450" cy="200" r="100" fill="%2310b981" opacity="0.35"/><rect x="80" y="60" width="440" height="220" rx="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)"/><text x="110" y="120" font-family="sans-serif" font-weight="700" font-size="20" fill="%23ffffff">Liquid Glass Color Tokens v2.4</text><text x="110" y="160" font-family="sans-serif" font-size="14" fill="%238696a0">Dark Obsidian #070b0e · Brand Emerald #10b981</text><text x="110" y="190" font-family="sans-serif" font-size="14" fill="%2353bdeb">Signature Cyan Read Tick #53bdeb</text><text x="110" y="240" font-family="sans-serif" font-size="12" fill="%2310b981">✓ Contrast Verified WCAG 2.2 AA</text></svg>',
          time: '09:24 AM',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-a4',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'The contrast ratios look crisp. Preserved our signature cyan read ticks (#53bdeb) as well.',
          time: '09:25 AM',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-a5',
          sender: 'them',
          senderDisplayName: 'Aarav Sharma',
          type: 'text',
          text: 'Awesome. Check out the document attachment from the engineering team when you have a moment.',
          time: '09:26 AM',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-a6',
          sender: 'them',
          senderDisplayName: 'Aarav Sharma',
          type: 'document',
          docName: 'IndiChat_MultiPlatform_Spec_v3.pdf',
          docSize: '2.4 MB · PDF Document',
          docPages: 18,
          time: '09:27 AM',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-a7',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Reviewing now. The four-zone layout with collapsible details panel fits desktop displays perfectly!',
          time: '09:28 AM',
          status: 'read',
          starred: false,
          reactions: { '🚀': 1 }
        }
      ]
    },
    {
      id: 'c-priya',
      name: 'Priya Patel',
      username: 'priya_p',
      avatarColor: 'linear-gradient(135deg, #ec4899, #be185d)',
      avatarInitials: 'PP',
      phoneNumber: '+91 98112 33445',
      bio: 'Lead Product Designer · IndiChat Studio 🚀',
      online: true,
      statusText: 'Online',
      lastSeen: 'Active now',
      unreadCount: 2,
      isGroup: false,
      pinned: true,
      starred: true,
      blocked: false,
      encryptionKey: '1092 8472 9014 3845 7712 9034 5510 2891',
      messages: [
        {
          id: 'm-p1',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Priya, how does the macOS traffic lights alignment look with our unified toolbar?',
          time: '08:40 AM',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-p2',
          sender: 'them',
          senderDisplayName: 'Priya Patel',
          type: 'text',
          text: 'It looks native and elegant! The left padding keeps the window controls distinct from the navigation rail.',
          time: '08:44 AM',
          status: 'read',
          starred: false,
          reactions: { '👍': 1 }
        },
        {
          id: 'm-p3',
          sender: 'them',
          senderDisplayName: 'Priya Patel',
          type: 'text',
          text: 'Also tested the Windows 11 caption controls on the right. Both feel authentic to their respective OS!',
          time: '08:48 AM',
          status: 'delivered',
          starred: false,
          reactions: {}
        }
      ]
    },
    {
      id: 'c-core-team',
      name: 'Core Engineering Group',
      username: 'indichat_core',
      avatarColor: 'linear-gradient(135deg, #00a884, #005c4b)',
      avatarInitials: 'CE',
      phoneNumber: '14 participants',
      bio: 'IndiChat Core Platform & Engine Architecture',
      online: false,
      statusText: '14 members · 4 online',
      lastSeen: 'Aarav, Priya, Rohan, Vikram...',
      unreadCount: 5,
      isGroup: true,
      pinned: false,
      starred: false,
      blocked: false,
      encryptionKey: '4920 1845 7721 9901 2487 6301 9823 4410',
      messages: [
        {
          id: 'm-g1',
          sender: 'Rohan Verma',
          senderDisplayName: 'Rohan Verma',
          type: 'text',
          text: 'The WebSocket reconnection loop test just passed 10,000 simulated offline receipts.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: { '⚡': 2 }
        },
        {
          id: 'm-g2',
          sender: 'Ananya Iyer',
          senderDisplayName: 'Ananya Iyer',
          type: 'text',
          text: 'Delivery ticks are verified: sent (1 grey), delivered (2 grey), read (2 cyan #53bdeb).',
          time: 'Yesterday',
          status: 'read',
          starred: true,
          reactions: {}
        },
        {
          id: 'm-g3',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Great work! Now testing the responsive desktop workspace at 1440x900 and 1024x768 viewports.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-g4',
          sender: 'Vikram Singh',
          senderDisplayName: 'Vikram Singh',
          type: 'text',
          text: 'Shared the audio call signaling logs for the browser simulation review.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        }
      ]
    },
    {
      id: 'c-ananya',
      name: 'Ananya Iyer',
      username: 'ananya_i',
      avatarColor: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      avatarInitials: 'AI',
      phoneNumber: '+91 97721 88902',
      bio: 'Design Systems · Accessibility & Flow 🌱',
      online: true,
      statusText: 'Online',
      lastSeen: 'Active now',
      unreadCount: 0,
      isGroup: false,
      pinned: false,
      starred: false,
      blocked: false,
      encryptionKey: '8831 2901 4452 7619 3302 9184 7725 1093',
      messages: [
        {
          id: 'm-ai1',
          sender: 'them',
          senderDisplayName: 'Ananya Iyer',
          type: 'text',
          text: 'Hi! I checked the WCAG 2.2 AA contrast on the light mode outgoing bubbles.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-ai2',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'How did it score? We wanted high contrast while retaining WhatsApp daylight green vibes.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-ai3',
          sender: 'them',
          senderDisplayName: 'Ananya Iyer',
          type: 'text',
          text: 'It scored 7.2:1 with #111b21 text over #d9fdd3 bubble background — perfectly accessible!',
          time: 'Yesterday',
          status: 'read',
          starred: true,
          reactions: { '💯': 1 }
        }
      ]
    },
    {
      id: 'c-rohan',
      name: 'Rohan Verma',
      username: 'rohan_v',
      avatarColor: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      avatarInitials: 'RV',
      phoneNumber: '+91 96540 12876',
      bio: 'Backend & Infrastructure · Coffee Enthusiast ☕',
      online: false,
      statusText: 'Last seen today at 07:15 AM',
      lastSeen: 'Today at 07:15 AM',
      unreadCount: 0,
      isGroup: false,
      pinned: false,
      starred: false,
      blocked: false,
      encryptionKey: '9012 3847 1192 8475 2291 4483 6710 9923',
      messages: [
        {
          id: 'm-r1',
          sender: 'them',
          senderDisplayName: 'Rohan Verma',
          type: 'audio',
          audioDuration: '0:42',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-r2',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Got your voice note! MinIO S3 media bucket upload latency is under 45ms locally.',
          time: 'Yesterday',
          status: 'read',
          starred: false,
          reactions: {}
        }
      ]
    },
    {
      id: 'c-vikram',
      name: 'Vikram Singh',
      username: 'vikram_s',
      avatarColor: 'linear-gradient(135deg, #f59e0b, #d97706)',
      avatarInitials: 'VS',
      phoneNumber: '+91 95412 77091',
      bio: 'Exploring new horizons 🏔️ · Mobile Tech',
      online: false,
      statusText: 'Last seen yesterday at 11:30 PM',
      lastSeen: 'Yesterday at 11:30 PM',
      unreadCount: 0,
      isGroup: false,
      pinned: false,
      starred: false,
      blocked: false,
      encryptionKey: '6712 9904 3321 8475 1192 8847 5520 1934',
      messages: [
        {
          id: 'm-v1',
          sender: 'them',
          senderDisplayName: 'Vikram Singh',
          type: 'payment',
          amount: '₹500',
          paymentStatus: 'Paid',
          text: 'Payment demo: ₹500 for the project team lunch bill 🍛',
          time: 'Nov 5',
          status: 'read',
          starred: false,
          reactions: {}
        },
        {
          id: 'm-v2',
          sender: 'me',
          senderDisplayName: 'Riya Kapoor',
          type: 'text',
          text: 'Received via UPI demo! Thanks Vikram.',
          time: 'Nov 5',
          status: 'read',
          starred: false,
          reactions: {}
        }
      ]
    }
  ];

  const DEFAULT_CALL_LOGS = [
    { id: 'cl-1', name: 'Aarav Sharma', type: 'incoming', date: 'Today, 09:30 AM', duration: '12m 40s', isVideo: false, color: '#10b981', initials: 'AS' },
    { id: 'cl-2', name: 'Priya Patel', type: 'missed', date: 'Today, 08:15 AM', duration: 'Missed', isVideo: true, color: '#ec4899', initials: 'PP' },
    { id: 'cl-3', name: 'Vikram Singh', type: 'outgoing', date: 'Yesterday, 06:10 PM', duration: '4m 12s', isVideo: false, color: '#f59e0b', initials: 'VS' },
    { id: 'cl-4', name: 'Ananya Iyer', type: 'incoming', date: 'Yesterday, 03:20 PM', duration: '28m 05s', isVideo: true, color: '#8b5cf6', initials: 'AI' },
    { id: 'cl-5', name: 'Rohan Verma', type: 'missed', date: 'Nov 4, 11:45 PM', duration: 'Missed', isVideo: false, color: '#3b82f6', initials: 'RV' }
  ];

  const DEFAULT_STATUS_UPDATES = [
    {
      id: 'st-self',
      isSelf: true,
      name: 'My Status',
      time: 'Add to my status',
      avatarColor: 'linear-gradient(135deg, #00a884, #10b981)',
      initials: 'RK',
      stories: [
        { id: 's-1', title: 'IndiChat Multi-Platform Launch 🚀', caption: 'Testing desktop and web previews today!', time: 'Today at 08:00 AM', bg: '#005c4b' }
      ]
    },
    {
      id: 'st-aarav',
      isSelf: false,
      name: 'Aarav Sharma',
      time: 'Today, 09:15 AM',
      avatarColor: 'linear-gradient(135deg, #10b981, #00a884)',
      initials: 'AS',
      hasUnseen: true,
      stories: [
        { id: 's-2', title: 'Bengaluru Morning Walk 🌿', caption: 'Fresh air before shipping the desktop build.', time: 'Today, 09:15 AM', bg: '#0a332c' }
      ]
    },
    {
      id: 'st-priya',
      isSelf: false,
      name: 'Priya Patel',
      time: 'Today, 07:45 AM',
      avatarColor: 'linear-gradient(135deg, #ec4899, #be185d)',
      initials: 'PP',
      hasUnseen: true,
      stories: [
        { id: 's-3', title: 'New Design Tokens 🎨', caption: 'Previewing Liquid Glass contrast on macOS & Windows.', time: 'Today, 07:45 AM', bg: '#4a154b' }
      ]
    },
    {
      id: 'st-ananya',
      isSelf: false,
      name: 'Ananya Iyer',
      time: 'Yesterday, 10:20 PM',
      avatarColor: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      initials: 'AI',
      hasUnseen: false,
      stories: [
        { id: 's-4', title: 'Accessibility Audit Pass 🎉', caption: 'Keyboard navigation and screen reader tags verified.', time: 'Yesterday, 10:20 PM', bg: '#2e1065' }
      ]
    }
  ];

  const DEFAULT_CONTACTS_DIRECTORY = [
    { id: 'usr-101', name: 'Aarav Sharma', username: 'aarav_s', phone: '+91 98765 00112', bio: 'Senior UI Engineer · Designing IndiChat ✨', isOnline: true, color: '#10b981', initials: 'AS' },
    { id: 'usr-102', name: 'Priya Patel', username: 'priya_p', phone: '+91 98112 33445', bio: 'Lead Product Designer 🚀', isOnline: true, color: '#ec4899', initials: 'PP' },
    { id: 'usr-103', name: 'Rohan Verma', username: 'rohan_v', phone: '+91 96540 12876', bio: 'Backend & Infrastructure ☕', isOnline: false, color: '#3b82f6', initials: 'RV' },
    { id: 'usr-104', name: 'Ananya Iyer', username: 'ananya_i', phone: '+91 97721 88902', bio: 'Design Systems & Flow 🌱', isOnline: true, color: '#8b5cf6', initials: 'AI' },
    { id: 'usr-105', name: 'Vikram Singh', username: 'vikram_s', phone: '+91 95412 77091', bio: 'Mobile Tech & Explorer 🏔️', isOnline: false, color: '#f59e0b', initials: 'VS' },
    { id: 'usr-106', name: 'Neha Gupta', username: 'neha_g', phone: '+91 94110 55678', bio: 'Engineering Lead ⚡', isOnline: true, color: '#06b6d4', initials: 'NG' },
    { id: 'usr-107', name: 'Kabir Mehta', username: 'kabir_m', phone: '+91 93221 44556', bio: 'Security & Cryptography 🔒', isOnline: false, color: '#6366f1', initials: 'KM' },
    { id: 'usr-108', name: 'Meera Das', username: 'meera_d', phone: '+91 92334 77889', bio: 'Product Operations 📋', isOnline: true, color: '#14b8a6', initials: 'MD' }
  ];

  const DEFAULT_USER_PROFILE = {
    displayName: 'Riya Kapoor',
    username: 'riya_k',
    phoneNumber: '+91 98765 43210',
    bio: 'Lead Architect · Building IndiChat multi-platform ✨',
    avatarInitials: 'RK',
    avatarColor: 'linear-gradient(135deg, #00a884, #10b981)',
    twoFactorEnabled: true,
    twoFactorPin: '482910',
    passkeyEnabled: true,
    readReceipts: true,
    enterIsSend: true,
    mediaVisibility: true,
    lastSeen: 'Everyone',
    profilePhotoVisibility: 'Everyone',
    disappearingMessages: 'Off',
    chatWallpaper: 'default', // 'default' | 'emerald' | 'obsidian' | 'blue' | 'slate'
    language: 'en',
    serverUrl: 'http://192.168.0.70:8080',
    lastBackupDate: 'Today, 04:15 AM (14.8 MB)',
    backupFrequency: 'Daily',
    appearanceMode: 'dark', // 'dark' | 'light'
    blurRadius: 20,
    reduceTransparency: false,
    reducedMotion: false,
    notifications: {
      messages: true,
      reactions: true,
      sound: 'Brisk',
      preview: true
    },
    storage: {
      mediaBytes: '142 MB',
      docBytes: '38 MB',
      cacheBytes: '24 MB'
    },
    passkeys: [
      { id: 'pk-1', name: 'MacBook Pro Touch ID', created: 'Oct 24, 2026', type: 'biometric' },
      { id: 'pk-2', name: 'YubiKey 5C NFC (Hardware Key)', created: 'Sep 12, 2026', type: 'hardware' }
    ],
    linkedDevices: [
      { id: 'dev-1', name: 'MacBook Pro 16" (Sonoma)', location: 'Bengaluru, India', active: 'Active now (This client)', isCurrent: true, type: 'macos' },
      { id: 'dev-2', name: 'Linux Desktop Workstation (Ubuntu 24)', location: 'Bengaluru, India', active: 'Yesterday at 08:15 PM', isCurrent: false, type: 'linux' },
      { id: 'dev-3', name: 'Windows 11 Surface Laptop', location: 'Bengaluru, India', active: 'Nov 4 at 02:30 PM', isCurrent: false, type: 'windows' }
    ],
    blockedContacts: [
      { id: 'blk-1', name: 'Unknown Caller (+91 91234 00000)', date: 'Oct 28' }
    ]
  };

  const SAMPLE_EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
    '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','✋','🤚','🖐️','🖖',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '🔥','✨','🎉','🚀','☕','🍕','🍔','🍟','🧁','🍺','🥂','🌈','⚡','⭐','🌟','💯'
  ];

  const SAMPLE_GIFS = [
    { title: 'Celebration Confetti', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%231a2634"/><circle cx="80" cy="70" r="16" fill="%23f59e0b"/><circle cx="150" cy="110" r="22" fill="%2310b981"/><circle cx="220" cy="60" r="18" fill="%23ec4899"/><text x="150" y="170" font-family="sans-serif" font-weight="700" font-size="16" fill="%23ffffff" text-anchor="middle">🎉 Congratulations! (GIF)</text></svg>' },
    { title: 'Coding in Flow', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%230b1318"/><rect x="40" y="30" width="220" height="120" rx="10" fill="%2316222b" stroke="%2310b981"/><text x="60" y="70" font-family="monospace" font-size="12" fill="%2310b981">const pass = true;</text><text x="60" y="95" font-family="monospace" font-size="12" fill="%2306b6d4">build.deploy();</text><text x="150" y="180" font-family="sans-serif" font-weight="700" font-size="15" fill="%23ffffff" text-anchor="middle">💻 In the Zone (GIF)</text></svg>' },
    { title: 'Team High Five', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23141f28"/><text x="100" y="110" font-size="48">🙌</text><text x="160" y="110" font-size="48">✨</text><text x="150" y="170" font-family="sans-serif" font-weight="700" font-size="15" fill="%23ffffff" text-anchor="middle">High Five! (GIF)</text></svg>' }
  ];

  const SAMPLE_STICKERS = [
    { name: 'Happy Emerald', icon: '🥑', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="%2310b981"/><circle cx="60" cy="70" r="8" fill="%2305080b"/><circle cx="100" cy="70" r="8" fill="%2305080b"/><path d="M50 100 Q80 130 110 100" stroke="%2305080b" stroke-width="6" fill="none" stroke-linecap="round"/></svg>' },
    { name: 'Thumbs Up Teal', icon: '👍', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="30" fill="%2300a884"/><text x="80" y="105" font-size="70" text-anchor="middle">👍</text></svg>' },
    { name: 'Rocket Launch', icon: '🚀', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="30" fill="%233b82f6"/><text x="80" y="105" font-size="70" text-anchor="middle">🚀</text></svg>' },
    { name: 'Heart Flame', icon: '🔥', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="30" fill="%23ec4899"/><text x="80" y="105" font-size="70" text-anchor="middle">💖</text></svg>' }
  ];

  const FAQ_ITEMS = [
    { q: 'How does end-to-end encryption work in IndiChat?', a: 'All messages, calls, media attachments, and status updates are encrypted with Signal-compatible Double Ratchet protocols. Private keys remain strictly on linked devices.' },
    { q: 'Can I use IndiChat without saving phone numbers?', a: 'Yes! IndiChat supports unique handles/usernames (e.g. @aarav_s) for peer-to-peer discovery without exposing personal phone numbers.' },
    { q: 'How do linked devices sync messages?', a: 'When you link a desktop or web client, an ephemeral cryptographic pairing key syncs your recent active threads via encrypted local session channels.' },
    { q: 'What happens when I revoke a device session?', a: 'Revocation immediately dispatches a 4001 status termination over WebSocket to that device, removing the session tokens and wiping the local decrypted cache.' }
  ];

  const DEFAULT_COMMUNITIES = [
    {
      id: 'comm-tech',
      name: 'Tech Design Circle',
      description: 'Design systems, architecture reviews, and client previews',
      subGroups: [
        { name: 'Core UI Team', members: 16, unread: 2 },
        { name: 'Design Tokens & Glass', members: 12, unread: 0 },
        { name: 'Web & Desktop Releases', members: 14, unread: 1 }
      ],
      membersCount: 42,
      iconColor: '#10b981',
      iconInitials: 'TD'
    },
    {
      id: 'comm-cyclists',
      name: 'Bengaluru Cyclists',
      description: 'Weekend routes, morning rides, and gear recommendations',
      subGroups: [
        { name: 'Nandi Hills Weekend', members: 10, unread: 0 },
        { name: 'Cubbon Park Morning', members: 8, unread: 0 }
      ],
      membersCount: 18,
      iconColor: '#06b6d4',
      iconInitials: 'BC'
    }
  ];

  const DEFAULT_PASSKEYS = [
    { id: 'pk-1', name: 'MacBook Pro Touch ID', created: 'Oct 24, 2026', type: 'biometric' },
    { id: 'pk-2', name: 'YubiKey 5C NFC (Hardware Key)', created: 'Sep 12, 2026', type: 'hardware' }
  ];

  return {
    DEFAULT_CONTACTS: DEFAULT_CONTACTS,
    DEFAULT_CALL_LOGS: DEFAULT_CALL_LOGS,
    DEFAULT_STATUS_UPDATES: DEFAULT_STATUS_UPDATES,
    DEFAULT_COMMUNITIES: DEFAULT_COMMUNITIES,
    DEFAULT_PASSKEYS: DEFAULT_PASSKEYS,
    DEFAULT_CONTACTS_DIRECTORY: DEFAULT_CONTACTS_DIRECTORY,
    DEFAULT_USER_PROFILE: DEFAULT_USER_PROFILE,
    SAMPLE_EMOJIS: SAMPLE_EMOJIS,
    SAMPLE_GIFS: SAMPLE_GIFS,
    SAMPLE_STICKERS: SAMPLE_STICKERS,
    FAQ_ITEMS: FAQ_ITEMS
  };
})();
