export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastActive: string;
  isAnnouncement?: boolean;
}

export interface CommunityItem {
  id: string;
  name: string;
  description: string;
  avatarBg: string;
  memberCount: number;
  groups: CommunityGroup[];
}

export const INITIAL_COMMUNITIES: CommunityItem[] = [
  {
    id: 'comm-developers',
    name: 'Developers & Engineering Network',
    description: 'Collaborate on modern web apps, distributed systems, architecture, and open source.',
    avatarBg: '#2563eb',
    memberCount: 3420,
    groups: [
      {
        id: 'cg-announcements',
        name: '📢 Tech Announcements',
        description: 'Only community admins can send messages.',
        memberCount: 3420,
        lastActive: '10:45 AM',
        isAnnouncement: true,
      },
      {
        id: 'cg-general',
        name: '💻 Full-Stack & System Design',
        description: 'Discussions on TypeScript, Java, React, and databases.',
        memberCount: 1850,
        lastActive: '11:15 AM',
      },
      {
        id: 'cg-showcase',
        name: '🚀 Project Showcase & Feedback',
        description: 'Share your creations and get constructive reviews.',
        memberCount: 920,
        lastActive: 'Yesterday',
      },
    ],
  },
  {
    id: 'comm-design',
    name: 'Design & Creative Guild',
    description: 'Product design, UI/UX aesthetics, typography, and motion graphics community.',
    avatarBg: '#059669',
    memberCount: 2100,
    groups: [
      {
        id: 'cg-uiux',
        name: '🎨 UI/UX Best Practices',
        description: 'Figma workflows, design systems, and micro-interactions.',
        memberCount: 2100,
        lastActive: '12:05 PM',
      },
      {
        id: 'cg-resources',
        name: '📚 Free Design Assets & Fonts',
        description: 'Curated palettes, icons, and typography tools.',
        memberCount: 1400,
        lastActive: '09:20 AM',
      },
    ],
  },
];
