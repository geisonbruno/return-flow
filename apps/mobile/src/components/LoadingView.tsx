import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Props {
  label?: string;
}

export default function LoadingView({ label }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
  label: {
    fontSize: 15,
    color: '#4B5563',
  },
});
