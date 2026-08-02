import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import { useAuth } from '../auth/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorMessage from '../components/ErrorMessage';
import LoadingView from '../components/LoadingView';
import type { RootStackParamList } from '../navigation/types';
import { formatDateTime, formatQuantityAndUnit, REASON_LABELS, STATUS_LABELS } from '../returns/returnOptions';
import { listReturns } from '../returns/returnService';
import type { ReturnRecord } from '../returns/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnList'>;

type ScreenState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; returns: ReturnRecord[] };

export default function ReturnListScreen({ navigation }: Props) {
  const { logout } = useAuth();
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
    return <LoadingView label="Loading your returns…" />;
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.message} onRetry={() => void load(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable style={styles.newReturnButton} onPress={() => navigation.navigate('CreateReturn')} accessibilityRole="button">
          <Text style={styles.newReturnLabel}>+ New Return</Text>
        </Pressable>
        <Pressable onPress={() => void logout()} accessibilityRole="button" testID="logout-button">
          <Text style={styles.logoutLabel}>Log out</Text>
        </Pressable>
      </View>

      <FlatList
        data={state.returns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={state.returns.length === 0 ? styles.emptyListContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={<EmptyState title="No returns yet." subtitle="Create your first return to get started." />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('ReturnDetails', { returnId: item.id })}
            accessibilityRole="button"
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.returnNumber}>{item.returnNumber}</Text>
              <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.meta}>{formatQuantityAndUnit(item.quantity, item.unit)}</Text>
              <Text style={styles.meta}>{REASON_LABELS[item.reason]}</Text>
            </View>
            <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  newReturnButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  newReturnLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  logoutLabel: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 15,
    padding: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  returnNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  customerName: {
    fontSize: 15,
    color: '#374151',
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
