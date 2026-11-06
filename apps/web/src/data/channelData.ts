export interface ChannelPost {
  id: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
  reactions: { emoji: string; count: number }[];
  views?: string;
}

export interface ChannelItem {
  id: string;
  name: string;
  handle?: string;
  avatarLetter: string;
  avatarBg: string;
  avatarUrl?: string;
  verified?: boolean;
  followers?: string;
  lastUpdateSnippet: string;
  timeStr: string;
  isFollowed: boolean;
  description?: string;
  posts: ChannelPost[];
}

export const INITIAL_CHANNELS: ChannelItem[] = [
  {
    id: 'ch-tech-news',
    name: 'Tech News & Trends ⚡',
    handle: '@technews',
    avatarLetter: '⚡',
    avatarBg: '#0f172a',
    verified: true,
    followers: '1.8M followers',
    timeStr: '12:15',
    lastUpdateSnippet: 'Breaking updates on modern web, cloud infrastructure, and AI tools...',
    isFollowed: true,
    description: 'Curated daily technology highlights, system architecture, and framework releases.',
    posts: [
      {
        id: 'post-1',
        content: `🚨 TECH HIGHLIGHT: Real-Time Web Architecture\n\nModern applications increasingly combine WebSockets for bidirectional low-latency messaging with HTTP REST for idempotent resource retrieval.\n\nDrop a ❤️ if you work with real-time stacks!`,
        timestamp: '12:15 PM',
        reactions: [
          { emoji: '🔥', count: 1420 },
          { emoji: '❤️', count: 2890 },
          { emoji: '👏', count: 640 },
        ],
        views: '38.4K',
      },
      {
        id: 'post-2',
        content: `WEEKLY POLL: Which backend language powers your primary APIs in 2026?\n1. Java / Spring Boot\n2. Go (Golang)\n3. Node.js / TypeScript\n4. Python / FastAPI`,
        timestamp: 'Yesterday',
        reactions: [
          { emoji: '👍', count: 3840 },
          { emoji: '🚀', count: 1620 },
        ],
        views: '54.1K',
      },
    ],
  },
  {
    id: 'ch-design-digest',
    name: 'Design Digest 🎨',
    handle: '@designdigest',
    avatarLetter: '🎨',
    avatarBg: '#059669',
    verified: true,
    followers: '940K followers',
    timeStr: 'Yesterday',
    lastUpdateSnippet: 'Micro-interactions and dark mode palette principles...',
    isFollowed: true,
    description: 'Exploring the subtle aesthetics of world-class user interfaces.',
    posts: [
      {
        id: 'post-dd-1',
        content: 'Design Insight: High-contrast dark themes should never use pure #000000 for cards and sidebars. Layered surface tones (#111b21, #202c33) provide visual depth and prevent eye strain.',
        imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
        timestamp: 'Yesterday 3:30 PM',
        reactions: [
          { emoji: '🎨', count: 4210 },
          { emoji: '💡', count: 2950 },
        ],
        views: '41K',
      },
    ],
  },
  {
    id: 'ch-announcements',
    name: 'IndiChat Official',
    handle: '@indichat',
    avatarLetter: 'IC',
    avatarBg: '#00a884',
    verified: true,
    followers: '3.2M followers',
    timeStr: 'Friday',
    lastUpdateSnippet: 'Multi-device sync, passkeys authentication and media optimizations live!',
    isFollowed: true,
    description: 'Official news and feature announcements from the IndiChat team.',
    posts: [
      {
        id: 'post-ic-1',
        content: '🚀 Welcome to IndiChat! Enjoy seamless end-to-end communication, voice & video calling, channels, status stories, and multi-device linked sessions.',
        timestamp: 'Friday 10:00 AM',
        reactions: [
          { emoji: '🎉', count: 8900 },
          { emoji: '❤️', count: 12400 },
        ],
        views: '120K',
      },
    ],
  },
];

export const SUGGESTED_CHANNELS: ChannelItem[] = [
  {
    id: 'ch-open-source',
    name: 'Open Source Community',
    handle: '@opensource',
    avatarLetter: '🌐',
    avatarBg: '#2563eb',
    verified: true,
    followers: '2.1M followers',
    timeStr: '',
    lastUpdateSnippet: 'Trending repositories, releases, and developer tools.',
    isFollowed: false,
    description: 'Explore the finest open source software and libraries.',
    posts: [],
  },
  {
    id: 'ch-productivity',
    name: 'Productivity Hacks',
    handle: '@productivity',
    avatarLetter: '⏱️',
    avatarBg: '#d97706',
    verified: true,
    followers: '1.4M followers',
    timeStr: '',
    lastUpdateSnippet: 'Workflows, shortcuts, and focus methodologies.',
    isFollowed: false,
    description: 'Master your daily deep work and creative workflows.',
    posts: [],
  },
];
