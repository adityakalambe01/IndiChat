export interface CallLogItem {
  id: string;
  contactName: string;
  targetUserId?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  isVideo: boolean;
  callCount?: number;
  timeStr: string;
  timestamp: number;
  avatarLetter?: string;
  avatarBg?: string;
  duration?: string;
}

export const INITIAL_CALLS_LIST: CallLogItem[] = [
  {
    id: 'call-1',
    contactName: 'Sarah Miller',
    type: 'outgoing',
    isVideo: true,
    timeStr: '10:24',
    timestamp: Date.now() - 2 * 3600 * 1000,
    avatarLetter: 'S',
    avatarBg: '#059669',
    duration: '4 min 12 sec',
  },
  {
    id: 'call-2',
    contactName: 'Alex Rivera',
    type: 'incoming',
    callCount: 2,
    isVideo: false,
    timeStr: 'Yesterday',
    timestamp: Date.now() - 24 * 3600 * 1000,
    avatarLetter: 'A',
    avatarBg: '#2563eb',
    duration: '12 min 30 sec',
  },
  {
    id: 'call-3',
    contactName: 'David Chen',
    type: 'missed',
    isVideo: false,
    timeStr: 'Yesterday',
    timestamp: Date.now() - 28 * 3600 * 1000,
    avatarLetter: 'D',
    avatarBg: '#7c3aed',
    duration: 'Missed',
  },
  {
    id: 'call-4',
    contactName: 'Design Standup',
    type: 'outgoing',
    callCount: 3,
    isVideo: true,
    timeStr: 'Thursday',
    timestamp: Date.now() - 4 * 24 * 3600 * 1000,
    avatarLetter: 'D',
    avatarBg: '#d97706',
    duration: '22 min 10 sec',
  },
  {
    id: 'call-5',
    contactName: 'Emma Watson',
    type: 'incoming',
    isVideo: true,
    timeStr: '10/22/2026',
    timestamp: Date.now() - 5 * 24 * 3600 * 1000,
    avatarLetter: 'E',
    avatarBg: '#db2777',
    duration: '8 min 45 sec',
  },
];
