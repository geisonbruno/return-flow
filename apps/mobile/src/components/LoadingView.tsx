import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/tokens';

interface Props {
  label?: string;
  /** `dark` is used by the redesigned driver screens; the default keeps every other screen exactly as it was. */
  tone?: 'light' | 'dark';
}

export default function LoadingView({ label, tone = 'light' }: Props) {
  const dark = tone === 'dark';
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <ActivityIndicator size="large" color={dark ? colors.green : undefined} />
      {label ? <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  containerDark: {
    backgroundColor: colors.page,
  },
  label: {
    fontSize: 15,
    color: '#4B5563',
  },
  labelDark: {
    color: colors.muted,
  },
});
