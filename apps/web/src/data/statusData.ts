export interface StatusStory {
  id: string;
  type: 'image' | 'text';
  content: string; // image URL or text string
  caption?: string;
  bgColor?: string; // for text status
  fontFamily?: string;
  timestamp: string;
  duration?: number; // in seconds
}

export interface UserStatus {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timeAgo: string;
  updatedAt: string;
  hasUnread: boolean;
  stories: StatusStory[];
}

export const INITIAL_STATUS_LIST: UserStatus[] = [
  {
    id: 'status-sarah',
    userId: 'u-sarah',
    userName: 'Sarah Jenkins',
    timeAgo: 'Today at 11:30',
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    hasUnread: true,
    stories: [
      {
        id: 's-sarah-1',
        type: 'text',
        content: '“Design is not just what it looks like and feels like. Design is how it works.” ✨',
        bgColor: '#1e3a8a',
        timestamp: '11:25 AM',
      },
      {
        id: 's-sarah-2',
        type: 'image',
        content: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        caption: 'Morning beach vibes 🌅🌊',
        timestamp: '11:30 AM',
      },
    ],
  },
  {
    id: 'status-alex',
    userId: 'u-alex',
    userName: 'Alex Rivera',
    timeAgo: 'Today at 09:45',
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    hasUnread: true,
    stories: [
      {
        id: 's-alex-1',
        type: 'text',
        content: 'Sprint goals delivered and all test suites green! 🚀 Coffee time ☕',
        bgColor: '#065f46',
        timestamp: '09:45 AM',
      },
    ],
  },
  {
    id: 'status-design-team',
    userId: 'u-design',
    userName: 'Design & UX Guild',
    timeAgo: 'Today at 08:15',
    updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    hasUnread: true,
    stories: [
      {
        id: 's-design-1',
        type: 'image',
        content: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
        caption: 'Design sprint workshop in full flow! 🎨',
        timestamp: '08:15 AM',
      },
    ],
  },
  {
    id: 'status-tech',
    userId: 'u-tech',
    userName: 'Tech Community Updates',
    timeAgo: 'Yesterday at 20:10',
    updatedAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    hasUnread: false,
    stories: [
      {
        id: 's-tech-1',
        type: 'text',
        content: 'New frontend and WebSocket optimizations launched today! ⚡',
        bgColor: '#7c3aed',
        timestamp: '08:10 PM',
      },
    ],
  },
];
