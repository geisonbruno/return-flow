import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryLabel}>Retry</Text>
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
  message: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryLabel: {
    color: '#B91C1C',
    fontWeight: '600',
  },
});
