/** Derive on every render so saved, staged, and OS motion changes apply immediately. */
export function navigationAnimation(isReducedMotion: boolean): 'none' | 'slide_from_right' {
  return isReducedMotion ? 'none' : 'slide_from_right';
}
