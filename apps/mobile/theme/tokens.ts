/**
 * apps/mobile/theme/tokens.ts
 *
 * Centralized design system tokens for IndiChat Liquid Glass:
 *  - Dark Obsidian & Daylight Light color palettes
 *  - Preserved WhatsApp-class checkmark tokens (#53bdeb)
 *  - Metric dimensions (compact 44px search, 18px glyphs, 56px headers, 60px dock)
 */

export const PALETTE = {
  // Brand
  brandEmerald: '#10b981',
  brandEmeraldDark: '#059669',
  brandTeal: '#00a884',
  brandTealDark: '#005c4b',

  // Preserved Ticks & Status
  tickCyan: '#53bdeb', // Preserved IndiChat read tick
  tickCyanHighContrast: '#0284c7', // Enhanced contrast for light mode
  tickGrey: '#8696a0', // Single/double grey tick
  accentCyan: '#06b6d4',
  accentDanger: '#f43f5e',
  accentWarning: '#f59e0b',
  accentIndigo: '#6366f1',
  accentPurple: '#8b5cf6',

  // Dark Obsidian
  dark: {
    bg: '#070b0e',
    surface: '#0e141a',
    surfaceElevated: '#131c24',
    surfaceTranslucent: 'rgba(19, 28, 36, 0.65)',
    surfaceHeader: 'rgba(11, 16, 21, 0.84)',
    surfaceDock: 'rgba(14, 20, 26, 0.78)',
    surfaceInput: 'rgba(255, 255, 255, 0.06)',
    glassInputBg: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    divider: 'rgba(255, 255, 255, 0.07)',
    textPrimary: '#ffffff',
    textSecondary: '#8696a0',
    textTertiary: '#5f707a',
    bubbleOutBg: '#005c4b',
    bubbleOutBorder: 'rgba(255, 255, 255, 0.15)',
    bubbleOutText: '#ffffff',
    bubbleInBg: '#1c2732',
    bubbleInBorder: 'rgba(255, 255, 255, 0.08)',
    bubbleInText: '#ffffff',
    pillDateBg: 'rgba(255, 255, 255, 0.12)',
    pillDateText: '#8696a0',
    tickBacking: 'transparent',
    dockActiveBg: 'rgba(255, 255, 255, 0.10)',
    dockActiveColor: '#ffffff',
    dockInactiveColor: '#8696a0',
    brandTealDark: '#005c4b',
    // Convenience aliases
    accent: '#10b981',
    emerald: '#10b981',
    teal: '#00a884',
    tickCyan: '#53bdeb',
    tickCyanHighContrast: '#0284c7',
    tickGrey: '#8696a0',
    danger: '#f43f5e',
    warning: '#f59e0b',
    indigo: '#6366f1',
    bgSecondary: '#1a2530',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
  },

  // Daylight (Light)
  light: {
    bg: '#f2f5f3',
    surface: '#ffffff',
    surfaceElevated: '#e6ece8',
    surfaceTranslucent: 'rgba(255, 255, 255, 0.75)',
    surfaceHeader: 'rgba(242, 245, 243, 0.88)',
    surfaceDock: 'rgba(255, 255, 255, 0.84)',
    surfaceInput: 'rgba(0, 0, 0, 0.04)',
    glassInputBg: 'rgba(0, 0, 0, 0.04)',
    border: 'rgba(0, 0, 0, 0.08)',
    borderStrong: 'rgba(0, 0, 0, 0.14)',
    divider: 'rgba(0, 0, 0, 0.07)',
    textPrimary: '#0f172a',
    textSecondary: '#5f707a',
    textTertiary: '#8696a0',
    bubbleOutBg: '#d9fdd3',
    bubbleOutBorder: 'rgba(0, 168, 132, 0.22)',
    bubbleOutText: '#0f172a',
    bubbleInBg: '#ffffff',
    bubbleInBorder: 'rgba(0, 0, 0, 0.06)',
    bubbleInText: '#0f172a',
    pillDateBg: '#e2e8e4',
    pillDateText: '#5f707a',
    // Enhanced backing pill for light mode read tick to guarantee contrast over #d9fdd3 (composited ratio 6.05:1 >= 5.81:1)
    tickBacking: 'rgba(11, 16, 22, 0.85)',
    dockActiveBg: 'rgba(0, 0, 0, 0.08)',
    dockActiveColor: '#005c4b',
    dockInactiveColor: '#5f707a',
    brandTealDark: '#005c4b',
    // Convenience aliases
    accent: '#059669',
    emerald: '#10b981',
    teal: '#00a884',
    tickCyan: '#53bdeb',
    tickCyanHighContrast: '#0284c7',
    tickGrey: '#8696a0',
    danger: '#f43f5e',
    warning: '#f59e0b',
    indigo: '#6366f1',
    bgSecondary: '#e8ecea',
    glassBorder: 'rgba(0, 0, 0, 0.08)',
  },
};

export const METRICS = {
  // Navigation & Headers
  headerHeight: 56,
  dockHeight: 64,
  dockBottomSpacing: 12,

  // Search Fields (Compact 44-48px)
  searchHeight: 44,
  searchIconSize: 18,

  // Icons
  headerIconSize: 20,
  dockIconSize: 20,
  menuRowIconSize: 18,

  // Radii
  cardRadius: 18,
  pillRadius: 14,
  buttonRadius: 12,
  inputRadius: 10,
  avatarRadius: 16,

  // Spacing & Scrolling
  scrollBottomPadding: 120, // Guarantees last card clears the dock by at least 40px
  horizontalPadding: 16,
};

/**
 * Shared typography font tokens strictly using bundled Inter:
 * Consistent across Web Preview, iOS, and Android.
 */
export const FONTS = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

/**
 * Deterministic avatar palette matching preview/preview-liquid-glass.html:
 * 8 varied deterministic squircle avatar background colors.
 */
export const PREVIEW_AVATAR_PALETTE = [
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#00a884', // Teal
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

export function getDeterministicAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PREVIEW_AVATAR_PALETTE.length;
  return PREVIEW_AVATAR_PALETTE[idx];
}

