import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme/tokens';

interface Props {
  message: string;
  onRetry?: () => void;
  /** `dark` is used by the redesigned driver screens; the default keeps every other screen exactly as it was. */
  tone?: 'light' | 'dark';
}

export default function ErrorMessage({ message, onRetry, tone = 'light' }: Props) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <Text style={[styles.message, dark && styles.messageDark]}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={[styles.retryButton, dark && styles.retryButtonDark]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={[styles.retryLabel, dark && styles.retryLabelDark]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  containerDark: {
    flex: 1,
    backgroundColor: colors.page,
  },
  message: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  messageDark: {
    color: colors.danger,
  },
  retryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonDark: {
    borderRadius: radius.md,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryLabel: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  retryLabelDark: {
    color: colors.danger,
  },
});
