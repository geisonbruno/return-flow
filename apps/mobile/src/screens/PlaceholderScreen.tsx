import { StyleSheet, Text, View } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ReturnFlow</Text>
      <Text>Driver app — scaffold in progress.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
});
