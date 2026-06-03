/**
 * Helper to trigger browser-native haptic feedback (vibration API)
 */
export function triggerHaptic(pattern: number | number[] = 15) {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic API is not supported or rejected:", e);
    }
  }
}
