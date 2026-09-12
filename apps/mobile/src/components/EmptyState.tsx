import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  /** `dark` is used by the redesigned driver screens; the default keeps every other screen exactly as it was. */
  tone?: 'light' | 'dark';
}

export default function EmptyState({ title, subtitle, tone = 'light' }: Props) {
  const dark = tone === 'dark';
  return (
    <View style={styles.container}>
      <Text style={[styles.title, dark && styles.titleDark]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, dark && styles.subtitleDark]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  titleDark: {
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  subtitleDark: {
    color: colors.muted,
  },
});
