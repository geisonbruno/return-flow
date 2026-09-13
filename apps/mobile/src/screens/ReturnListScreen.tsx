import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import BottomNavigation from '../components/BottomNavigation';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import { Icon } from '../components/Icon';
import LoadingView from '../components/LoadingView';
import type { RootStackParamList } from '../navigation/types';
import { formatDateTime, formatQuantityAndUnit, REASON_LABELS } from '../returns/returnOptions';
import { listReturns } from '../returns/returnService';
import { statusLabel, statusPresentation } from '../returns/statusPresentation';
import type { ReturnRecord } from '../returns/types';
import { colors, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnList'>;

type ScreenState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; returns: ReturnRecord[] };

/** The muted rule separating two metadata values, as in the approved design. */
function MetaDivider() {
  return (
    <Text style={styles.metaDivider} accessibilityElementsHidden importantForAccessibility="no">
      |
    </Text>
  );
}

export default function ReturnListScreen({ navigation }: Props) {
  const [state, setState] = useState<ScreenState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setState({ status: 'loading' });
    }
    try {
      const returns = await listReturns();
      setState({ status: 'ready', returns });
    } catch (error) {
      setState({ status: 'error', message: toSafeErrorMessage(error, 'Unable to load your returns.') });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Fires on initial mount too, so the list stays correct after creating
    // a return and navigating back — no separate mount-only effect needed.
    return navigation.addListener('focus', () => {
      void load(false);
    });
  }, [navigation, load]);

  if (state.status === 'loading') {
    return <LoadingView label="Loading your returns…" tone="dark" />;
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.message} onRetry={() => void load(false)} tone="dark" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Heading only. The single New Return entry point on this screen is the
          bottom navigation's centre item — no duplicate top action. */}
      <Text style={styles.title} accessibilityRole="header">
        My returns
      </Text>

      <FlatList
        data={state.returns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={state.returns.length === 0 ? styles.emptyListContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.muted}
            colors={[colors.green]}
            progressBackgroundColor={colors.surfaceRaised}
          />
        }
        ListEmptyComponent={
          <EmptyState title="No returns yet." subtitle="Create your first return to get started." tone="dark" />
        }
        renderItem={({ item }) => {
          const badge = statusPresentation(item.status);
          const label = statusLabel(item.status);
          const signatureCaptured = Boolean(item.signature);
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ReturnDetails', { returnId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`${item.returnNumber}, ${item.productName}, ${label}`}
              testID={`return-card-${item.id}`}
            >
              <View style={styles.cardBody}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.returnNumber}>{item.returnNumber}</Text>
                  <Text style={[styles.status, { color: badge.color, backgroundColor: badge.background }]}>
                    {label}
                  </Text>
                </View>

                <Text style={styles.productName}>{item.productName}</Text>
                <Text style={styles.customerName}>{item.customerName}</Text>

                <View style={styles.cardMetaRow}>
                  <Text style={styles.meta}>{formatQuantityAndUnit(item.quantity, item.unit)}</Text>
                  <MetaDivider />
                  <Text style={styles.meta}>{REASON_LABELS[item.reason]}</Text>
                </View>

                <View style={styles.cardMetaRow}>
                  <Text style={styles.meta}>Photos: {item.photos.length}</Text>
                  <MetaDivider />
                  <Text style={styles.meta}>
                    Signature: <Text style={signatureCaptured ? styles.metaCaptured : styles.meta}>
                      {signatureCaptured ? 'Captured' : 'Pending'}
                    </Text>
                  </Text>
                </View>

                <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
              </View>

              <View style={styles.disclosure} pointerEvents="none">
                <Icon name="chevron-right" size={20} color={colors.muted} />
              </View>
            </Pressable>
          );
        }}
      />

      <BottomNavigation active="returns" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.page,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg + spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    // Clears the bottom navigation so the last card stays fully reachable.
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs + 1,
  },
  disclosure: {
    width: 20,
    alignItems: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs - 2,
  },
  returnNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    fontSize: 13,
    fontWeight: '500',
    // A fully rounded pill, as in the approved design.
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  customerName: {
    fontSize: 14,
    color: colors.muted,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 14,
    color: colors.muted,
  },
  metaCaptured: {
    fontSize: 14,
    color: colors.green,
  },
  metaDivider: {
    fontSize: 14,
    color: colors.border,
  },
  date: {
    fontSize: 14,
    color: '#78838E',
    marginTop: spacing.xs - 2,
  },
});
