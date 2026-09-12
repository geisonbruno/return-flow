import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/** The two screens that can render as the *selected* tab. New Return is an action, never a destination that stays selected. */
export type BottomNavTab = 'returns' | 'profile';

interface Props {
  active: BottomNavTab;
  /** The screen's own stack navigation object — the same one it already receives. */
  navigation: { navigate: (screen: keyof RootStackParamList, params?: never) => void };
}

interface Item {
  key: string;
  label: string;
  icon: IconName;
  target: keyof RootStackParamList;
  /** Which tab must be active for this item to read as selected; actions leave it undefined. */
  selectedWhen?: BottomNavTab;
}

const ITEMS: readonly Item[] = [
  { key: 'returns', label: 'Returns', icon: 'returns', target: 'ReturnList', selectedWhen: 'returns' },
  { key: 'new-return', label: 'New Return', icon: 'plus-circle', target: 'CreateReturn' },
  { key: 'profile', label: 'Profile', icon: 'user', target: 'Profile', selectedWhen: 'profile' },
];

/**
 * The authenticated main navigation, shared by My Returns and Profile.
 *
 * <p>Deliberately a plain component over the existing native stack rather than
 * a nested tab navigator: the MVP needs three destinations, and
 * `@react-navigation/bottom-tabs` would be a new dependency and a navigation
 * architecture change for no behavioural gain. Every item navigates to a route
 * the stack already declares, so no route is duplicated and no workflow
 * changes — New Return in particular enters the existing CreateReturn flow.
 *
 * <p>It is not rendered during the focused return-creation workflow (Create
 * Return, Add Photos, Customer Signature) or on Login.
 */
export default function BottomNavigation({ active, navigation }: Props) {
  return (
    // `SafeAreaView edges={['bottom']}` rather than `useSafeAreaInsets()`: the
    // hook throws without a `SafeAreaProvider` above it, which would make this
    // component unrenderable in the screen tests that mount a screen directly.
    // The inner row keeps its own minimum padding for devices with no inset.
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bar}>
      <View style={styles.row} accessibilityRole="tablist">
      {ITEMS.map((item) => {
        const selected = item.selectedWhen === active;
        const tint = selected ? colors.green : colors.muted;
        return (
          <Pressable
            key={item.key}
            style={styles.item}
            onPress={() => navigation.navigate(item.target)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            testID={`bottom-nav-${item.key}`}
          >
            {/* The green rule sitting above the active item in the approved design. */}
            <View style={[styles.indicator, selected && styles.indicatorActive]} />
            <Icon name={item.icon} size={24} color={tint} />
            {/* The label is always present: the active item is never signalled by colour alone. */}
            <Text style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surfaceRaised,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.xs + 2,
    paddingBottom: spacing.xs,
  },
  indicator: {
    width: 56,
    height: 2,
    borderRadius: 2,
    marginBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.green,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  labelActive: {
    color: colors.green,
  },
});
