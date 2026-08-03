import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, toSafeErrorMessage } from '../api/problemDetails';
import ErrorMessage from '../components/ErrorMessage';
import LoadingView from '../components/LoadingView';
import type { RootStackParamList } from '../navigation/types';
import { formatDateTime, formatQuantityAndUnit, REASON_LABELS, STATUS_LABELS } from '../returns/returnOptions';
import { getReturn } from '../returns/returnService';
import type { ReturnRecord } from '../returns/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnDetails'>;

type ScreenState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; record: ReturnRecord };

const MAX_PHOTOS = 5;

export default function ReturnDetailsScreen({ navigation, route }: Props) {
  const { returnId } = route.params;
  const [state, setState] = useState<ScreenState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const record = await getReturn(returnId);
      setState({ status: 'ready', record });
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 404
          ? 'This return could not be found.'
          : toSafeErrorMessage(error, 'Unable to load this return.');
      setState({ status: 'error', message });
    }
  }, [returnId]);

  useEffect(() => {
    // Standard fetch-on-mount/param-change: `load` synchronously sets a
    // "loading" state before its first await, which is the correct and
    // intended behavior here, not an accidental cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <LoadingView label="Loading return…" />;
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.message} onRetry={() => void load()} />;
  }

  const { record } = state;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.returnNumber}>{record.returnNumber}</Text>
        <Text style={styles.status}>{STATUS_LABELS[record.status]}</Text>

        <DetailRow label="Customer" value={record.customerName} />
        <DetailRow label="Product" value={record.productName} />
        <DetailRow label="Reason" value={REASON_LABELS[record.reason]} />
        {record.reasonDetails ? <DetailRow label="Reason details" value={record.reasonDetails} /> : null}
        <DetailRow label="Quantity" value={formatQuantityAndUnit(record.quantity, record.unit)} />
        <DetailRow label="Observation" value={record.observation} />
        <DetailRow label="Driver" value={record.driver.fullName} />
        <DetailRow label="Route" value={`${record.route.code} — ${record.route.name}`} />
        <DetailRow label="Created" value={formatDateTime(record.createdAt)} />

        <View style={styles.photosSection}>
          <View style={styles.photosSectionHeader}>
            <Text style={styles.rowLabel}>Photos</Text>
            {record.photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={() => navigation.navigate('AddReturnPhotos', { returnId: record.id })}
                accessibilityRole="button"
                testID="add-photos-button"
              >
                <Text style={styles.addPhotosLabel}>Add photos</Text>
              </Pressable>
            ) : null}
          </View>
          {record.photos.length === 0 ? (
            <Text style={styles.emptyPhotosText}>No photos yet.</Text>
          ) : (
            <View style={styles.photosList}>
              {record.photos.map((photo) => (
                <View key={photo.id} style={styles.photoChip} testID={`photo-${photo.position}`}>
                  <Text style={styles.photoChipLabel}>Photo {photo.position}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  returnNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  status: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  rowValue: {
    fontSize: 16,
    color: '#111827',
  },
  photosSection: {
    gap: 8,
    paddingVertical: 8,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPhotosLabel: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#6B7280',
  },
  photosList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  photoChipLabel: {
    fontSize: 13,
    color: '#374151',
  },
});
