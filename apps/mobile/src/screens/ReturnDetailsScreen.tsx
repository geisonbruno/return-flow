import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, toSafeErrorMessage } from '../api/problemDetails';
import AuthenticatedImage from '../components/AuthenticatedImage';
import AuthenticatedSvg from '../components/AuthenticatedSvg';
import BottomNavigation from '../components/BottomNavigation';
import ErrorMessage from '../components/ErrorMessage';
import { Icon } from '../components/Icon';
import LoadingView from '../components/LoadingView';
import StepIndicator from '../components/StepIndicator';
import type { RootStackParamList } from '../navigation/types';
import { formatDateTime, formatQuantityAndUnit, REASON_LABELS } from '../returns/returnOptions';
import { getReturn } from '../returns/returnService';
import { statusLabel, statusPresentation } from '../returns/statusPresentation';
import type { ReturnRecord } from '../returns/types';
import { colors, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ReturnDetails'>;

type ScreenState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; record: ReturnRecord };

const MAX_PHOTOS = 5;

export default function ReturnDetailsScreen({ navigation, route }: Props) {
  const { returnId, origin } = route.params;
  /**
   * Only the arrival that completes the guided flow presents this screen as
   * its Review step. Opening an existing return from My Returns is an
   * inspection, not a wizard, so it shows no step indicator.
   */
  const guidedReview = origin === 'created';
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

  const screenHeader = (
    <View style={styles.header}>
      <Pressable
        style={styles.back}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        testID="return-details-back-button"
      >
        <Icon name="chevron-left" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Return Details
      </Text>
      {/* Balances the back control so the title stays centred. */}
      <View style={styles.back} />
    </View>
  );

  if (state.status === 'loading') {
    return <LoadingView label="Loading return…" tone="dark" />;
  }

  if (state.status === 'error') {
    return <ErrorMessage message={state.message} onRetry={() => void load()} tone="dark" />;
  }

  const { record } = state;
  const badge = statusPresentation(record.status);
  const canAddPhotos = record.photos.length < MAX_PHOTOS;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {screenHeader}

      {/* Step 4 of the guided flow, and only there. The return is already
          complete — this is presentational context, not a pending action. */}
      {guidedReview ? <StepIndicator currentStep={4} /> : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headline}>
          <Text style={styles.returnNumber}>{record.returnNumber}</Text>
          <Text style={[styles.status, { color: badge.color, backgroundColor: badge.background }]}>
            {statusLabel(record.status)}
          </Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Customer" value={record.customerName} />
          <DetailRow label="Product" value={record.productName} />
          <DetailRow label="Reason" value={REASON_LABELS[record.reason]} />
          {record.reasonDetails ? <DetailRow label="Reason details" value={record.reasonDetails} /> : null}
          <DetailRow label="Quantity" value={formatQuantityAndUnit(record.quantity, record.unit)} />
          <DetailRow label="Observation" value={record.observation} />
          <DetailRow label="Driver" value={record.driver.fullName} />
          <DetailRow label="Route" value={`${record.route.code} — ${record.route.name}`} />
          <DetailRow label="Created" value={formatDateTime(record.createdAt)} />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              {/* Two nodes so the section keeps its plain "Photos" name
                  alongside the live count. */}
              <Text style={styles.sectionTitle}>Photos</Text>
              <Text style={styles.sectionCount}>({record.photos.length})</Text>
            </View>
            {canAddPhotos ? (
              <Pressable
                style={styles.sectionAction}
                onPress={() => navigation.navigate('AddReturnPhotos', { returnId: record.id, origin: 'details' })}
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                hitSlop={8}
                testID="add-photos-button"
              >
                <Icon name="plus" size={15} color={colors.green} />
                <Text style={styles.sectionActionLabel}>Add photos</Text>
              </Pressable>
            ) : null}
          </View>

          {record.photos.length === 0 ? (
            <Text style={styles.emptyText}>No photos yet.</Text>
          ) : (
            <View style={styles.photoGrid}>
              {record.photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile} testID={`photo-${photo.position}`}>
                  {/* The real image, through the same authenticated media path
                      the Add Photos step uses — no second pipeline. */}
                  <AuthenticatedImage
                    contentPath={photo.contentPath}
                    accessibilityLabel={`Photo ${photo.position}`}
                    style={styles.photoImage}
                    testID={`photo-image-${photo.position}`}
                  />
                </View>
              ))}
              {canAddPhotos ? (
                <Pressable
                  style={styles.addTile}
                  onPress={() => navigation.navigate('AddReturnPhotos', { returnId: record.id, origin: 'details' })}
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                  testID="add-photo-tile"
                >
                  <Icon name="plus" size={22} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer signature</Text>
            <Text
              style={[
                styles.signatureBadge,
                record.signature ? styles.signatureBadgeCaptured : styles.signatureBadgePending,
              ]}
              testID="signature-status"
            >
              {record.signature ? 'Captured' : 'Pending'}
            </Text>
          </View>

          {record.signature ? (
            <View style={styles.signatureBlock}>
              <AuthenticatedSvg
                contentPath={record.signature.contentPath}
                accessibilityLabel="Customer signature"
                width={140}
                height={64}
                testID="signature-image"
              />
              <View style={styles.signatureMeta}>
                <Text style={styles.signatureSigner}>{record.signature.signerName}</Text>
                <Text style={styles.signatureTimestamp}>{formatDateTime(record.signature.signedAt)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.signaturePending}>
              <Text style={styles.emptyText}>No customer signature yet.</Text>
              <Pressable
                style={styles.sectionAction}
                onPress={() => navigation.navigate('CustomerSignature', { returnId: record.id })}
                accessibilityRole="button"
                accessibilityLabel="Capture customer signature"
                hitSlop={8}
                testID="capture-signature-button"
              >
                <Text style={styles.sectionActionLabel}>Capture customer signature</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNavigation active="returns" navigation={navigation} />
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
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  returnNumber: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: colors.text,
    flexShrink: 1,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sectionCount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 32,
  },
  sectionActionLabel: {
    color: colors.green,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  photoTile: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addTile: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  signatureBadge: {
    fontSize: 12,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  signatureBadgeCaptured: {
    color: colors.success,
    backgroundColor: colors.successSurface,
  },
  signatureBadgePending: {
    color: colors.warning,
    backgroundColor: colors.warningSurface,
  },
  signatureBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  signatureMeta: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  signatureSigner: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  signatureTimestamp: {
    fontSize: 12,
    color: colors.muted,
  },
  signaturePending: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
});
