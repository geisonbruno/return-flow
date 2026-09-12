import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

/** "DRIVER" → "Driver": the role is shown as a word, not a backend enum. */
const ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Driver',
  ADMIN: 'Admin',
};

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * MVP identity and sign-out only — deliberately not account management.
 *
 * <p>Everything shown comes from the authenticated user already held in
 * `AuthContext`; the screen issues no request of its own and `/auth/me` is
 * untouched. The driver's route is **not** shown: the authenticated-user
 * contract does not carry one, and inventing it would be worse than omitting
 * it. The tenant/warehouse name is deliberately not shown either — it is still
 * carried in the session and the API, it simply earns no place on an MVP
 * profile whose job is identity, role and sign-out. Technical identifiers
 * (user id, tenant id) are never displayed.
 */
export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      // The one shared implementation — clearing tokens and session state, and
      // returning to Login through the existing auth-status gate.
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const fullName = user?.fullName ?? '';
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{initialsOf(fullName)}</Text>
          </View>
          <Text style={styles.fullName}>{fullName}</Text>
          {user ? <Text style={styles.email}>{user.email}</Text> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Account</Text>
          <Text style={styles.panelValue}>{roleLabel}</Text>
        </View>

        <Pressable
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          testID="logout-button"
        >
          {signingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.logoutLabel}>Log out</Text>
          )}
        </Pressable>
      </ScrollView>

      <BottomNavigation active="profile" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: colors.green,
  },
  avatarLabel: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.green,
  },
  fullName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  email: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  panelLabel: {
    fontSize: 14,
    color: colors.muted,
  },
  panelValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  logoutButton: {
    marginTop: spacing.sm,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger,
  },
});
