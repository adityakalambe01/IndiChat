/**
 * apps/mobile/utils/useUnsavedChangesGuard.ts
 *
 * Supported Unsaved Changes Protection Hook:
 *  - Uses expo-router's official `usePreventRemove`
 *  - Handles native stack swipe-back gesture on iOS
 *  - Handles Android hardware back button & header back button
 *  - Prompts with native Alert dialog before discarding edits
 */

import { Alert } from 'react-native';
import { usePreventRemove } from 'expo-router';

export function useUnsavedChangesGuard(
  isDirty: boolean,
  options?: {
    title?: string;
    message?: string;
    discardText?: string;
    keepEditingText?: string;
    onDiscard?: () => void;
  }
) {
  const title = options?.title || 'Discard Unsaved Changes?';
  const message = options?.message || 'You have unsaved edits on this page. Leaving will discard your modifications.';
  const discardText = options?.discardText || 'Discard & Leave';
  const keepEditingText = options?.keepEditingText || 'Keep Editing';

  usePreventRemove(isDirty, ({ repeat }) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: keepEditingText,
          style: 'cancel',
          onPress: () => {
            // Stay on current screen
          },
        },
        {
          text: discardText,
          style: 'destructive',
          onPress: () => {
            options?.onDiscard?.();
            repeat(); // Executes the blocked navigation
          },
        },
      ],
      { cancelable: true }
    );
  });
}
