import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import AuthenticatedImage from '../components/AuthenticatedImage';
import { Icon } from '../components/Icon';
import StepIndicator from '../components/StepIndicator';
import type { RootStackParamList } from '../navigation/types';
import { normalizePhotoToJpeg } from '../returns/photoNormalization';
import type { NormalizedPhoto } from '../returns/photoNormalization';
import { listReturnPhotos, uploadReturnPhoto } from '../returns/returnService';
import type { ReturnPhoto } from '../returns/types';
import { colors, radius, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AddReturnPhotos'>;

const MAX_PHOTOS = 5;

type QueuedPhotoStatus = 'normalizing' | 'uploading' | 'failed';

interface QueuedPhoto {
  localId: string;
  uri: string;
  status: QueuedPhotoStatus;
  normalized?: NormalizedPhoto;
  errorMessage?: string;
}

export default function AddReturnPhotosScreen({ navigation, route }: Props) {
  const { returnId, origin } = route.params;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<ReturnPhoto[]>([]);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  /** Tracks photos removed from the queue while still normalizing, so a slow-resolving normalize/upload never resurrects one the user already removed. */
  const removedLocalIds = useRef<Set<string>>(new Set());
  /** Tracks in-flight uploads by localId so a fast repeated tap on Retry can never start a second upload for the same photo. */
  const inFlightUploads = useRef<Set<string>>(new Set());

  const uploadedCount = uploadedPhotos.length;
  // Capacity must count local selections too — not just persisted photos —
  // so the driver can never queue more than the remaining five-photo slots.
  const capacityUsed = uploadedPhotos.length + queue.length;
  const uploadInProgress = queue.some((item) => item.status === 'uploading' || item.status === 'normalizing');
  // Continue means "every selected photo is actually uploaded" — a failed or
  // still-pending item must keep it disabled, not just an active upload.
  const hasIncompleteSelections = queue.length > 0;
  const canAddMore = capacityUsed < MAX_PHOTOS;

  const loadExistingPhotos = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const photos = await listReturnPhotos(returnId);
      setUploadedPhotos(photos);
    } catch (error) {
      setLoadError(toSafeErrorMessage(error, 'Unable to load this return’s photos.'));
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadExistingPhotos();
  }, [loadExistingPhotos]);

  const uploadQueuedPhoto = useCallback(
    async (localId: string, normalized: NormalizedPhoto) => {
      // A fast repeated tap (e.g. double-pressing Retry) must never start a
      // second upload for the same photo — checked and reserved
      // synchronously, before any await, so two near-simultaneous calls
      // can't both pass the check before either sets the flag.
      if (inFlightUploads.current.has(localId)) {
        return;
      }
      inFlightUploads.current.add(localId);
      setQueue((prev) => prev.map((item) => (item.localId === localId ? { ...item, status: 'uploading', errorMessage: undefined } : item)));
      try {
        const uploaded = await uploadReturnPhoto(returnId, normalized);
        setUploadedPhotos((prev) => [...prev, uploaded]);
        setQueue((prev) => prev.filter((item) => item.localId !== localId));
      } catch (error) {
        const message = toSafeErrorMessage(error, 'Upload failed. The return itself was already created — you can retry.');
        setQueue((prev) => prev.map((item) => (item.localId === localId ? { ...item, status: 'failed', errorMessage: message } : item)));
      } finally {
        inFlightUploads.current.delete(localId);
      }
    },
    [returnId],
  );

  const addAsset = useCallback(
    async (uri: string, width: number, height: number) => {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setQueue((prev) => [...prev, { localId, uri, status: 'normalizing' }]);
      try {
        const normalized = await normalizePhotoToJpeg(uri, width, height);
        if (removedLocalIds.current.has(localId)) {
          return;
        }
        setQueue((prev) => prev.map((item) => (item.localId === localId ? { ...item, normalized } : item)));
        await uploadQueuedPhoto(localId, normalized);
      } catch (error) {
        const message = toSafeErrorMessage(error, 'This photo could not be prepared for upload.');
        setQueue((prev) => prev.map((item) => (item.localId === localId ? { ...item, status: 'failed', errorMessage: message } : item)));
      }
    },
    [uploadQueuedPhoto],
  );

  const pickFromLibrary = useCallback(async () => {
    if (picking || !canAddMore) {
      return;
    }
    setPicking(true);
    setPermissionMessage(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPermissionMessage('Photo library access is required to add photos from your library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        await addAsset(asset.uri, asset.width, asset.height);
      }
    } finally {
      setPicking(false);
    }
  }, [addAsset, canAddMore, picking]);

  const takePhoto = useCallback(async () => {
    if (picking || !canAddMore) {
      return;
    }
    setPicking(true);
    setPermissionMessage(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPermissionMessage('Camera access is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        await addAsset(asset.uri, asset.width, asset.height);
      }
    } finally {
      setPicking(false);
    }
  }, [addAsset, canAddMore, picking]);

  const removeQueuedPhoto = useCallback((localId: string) => {
    removedLocalIds.current.add(localId);
    setQueue((prev) => prev.filter((item) => item.localId !== localId));
  }, []);

  const retryQueuedPhoto = useCallback(
    (localId: string) => {
      const item = queue.find((candidate) => candidate.localId === localId);
      if (!item || !item.normalized) {
        return;
      }
      void uploadQueuedPhoto(localId, item.normalized);
    },
    [queue, uploadQueuedPhoto],
  );

  // `origin` makes the destination explicit rather than inferred from
  // navigation history: the primary new-return flow ('created') still needs
  // the customer signature next, while the secondary "add more photos
  // later" flow from Return Details ('details') just returns there.
  //
  // Skip for now and Continue deliberately share this one transition: they
  // express different intent but have no different side effect, and inventing
  // one (a "photos skipped" flag, say) would mean new backend state.
  const finish = useCallback(() => {
    if (origin === 'created') {
      navigation.replace('CustomerSignature', { returnId });
    } else {
      navigation.replace('ReturnDetails', { returnId });
    }
  }, [navigation, origin, returnId]);

  const screenHeader = (
    <View style={styles.header}>
      <Pressable
        style={styles.back}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        testID="add-photos-back-button"
      >
        <Icon name="chevron-left" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        Add Photos
      </Text>
      {/* Balances the back control so the title stays centred. */}
      <View style={styles.back} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {screenHeader}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.loadingLabel}>Loading photos…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {screenHeader}
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadExistingPhotos()} accessibilityRole="button">
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasAnyPhoto = uploadedPhotos.length > 0 || queue.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {screenHeader}

      {/* Step 2 of the guided flow: Details is behind us, Photos is current. */}
      <StepIndicator currentStep={2} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          {origin === 'created'
            ? 'Your return has been created. Add photos now, or skip and add them later.'
            : 'Add more photos to this return, or go back when you’re done.'}
        </Text>
        <Text style={styles.countLabel} testID="photo-count">
          {uploadedCount} of {MAX_PHOTOS} photos uploaded
        </Text>

        {hasAnyPhoto ? (
          <View style={styles.thumbnailGrid}>
            {uploadedPhotos.map((photo) => (
              <View key={photo.id} style={styles.thumbnailCard} testID={`uploaded-photo-${photo.position}`}>
                {/* The real image, fetched through the authenticated content
                    endpoint — the driver can see what is actually attached. */}
                <AuthenticatedImage
                  contentPath={photo.contentPath}
                  accessibilityLabel={`Photo ${photo.position}`}
                  style={styles.thumbnailImage}
                  testID={`uploaded-photo-image-${photo.position}`}
                />
              </View>
            ))}
            {queue.map((item) => (
              <View key={item.localId} style={styles.thumbnailCard} testID="queued-photo">
                <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                {item.status === 'normalizing' || item.status === 'uploading' ? (
                  <View style={styles.thumbnailOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                    <Text style={styles.thumbnailOverlayLabel}>{item.status === 'normalizing' ? 'Preparing…' : 'Uploading…'}</Text>
                  </View>
                ) : null}
                {item.status === 'failed' ? (
                  <View style={styles.thumbnailFailed}>
                    <Text style={styles.failedText}>{item.errorMessage}</Text>
                    <View style={styles.failedActions}>
                      <Pressable
                        onPress={() => retryQueuedPhoto(item.localId)}
                        accessibilityRole="button"
                        testID={`retry-${item.localId}`}
                      >
                        <Text style={styles.retryInlineLabel}>Retry</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeQueuedPhoto(item.localId)}
                        accessibilityRole="button"
                        testID={`remove-${item.localId}`}
                      >
                        <Text style={styles.removeInlineLabel}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
                {item.status !== 'failed' && item.status !== 'uploading' ? (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeQueuedPhoto(item.localId)}
                    accessibilityRole="button"
                    testID={`remove-${item.localId}`}
                  >
                    <Text style={styles.removeButtonLabel}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.placeholder} testID="photo-placeholder">
            <Icon name="camera" size={30} color={colors.muted} />
            <Text style={styles.placeholderText}>Add photos of the item, packaging{'\n'}or any relevant details.</Text>
          </View>
        )}

        {permissionMessage ? <Text style={styles.permissionMessage}>{permissionMessage}</Text> : null}
        {!canAddMore ? <Text style={styles.limitMessage}>You have reached the five-photo limit.</Text> : null}

        <Pressable
          style={[styles.actionButton, (!canAddMore || picking) && styles.actionButtonDisabled]}
          onPress={() => void pickFromLibrary()}
          disabled={!canAddMore || picking}
          accessibilityRole="button"
          accessibilityLabel="Add from library"
          testID="add-from-library-button"
        >
          <Icon name="image" size={19} color={colors.text} />
          <Text style={styles.actionLabel}>Add from library</Text>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Pressable
            style={[styles.actionButton, (!canAddMore || picking) && styles.actionButtonDisabled]}
            onPress={() => void takePhoto()}
            disabled={!canAddMore || picking}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            testID="take-photo-button"
          >
            <Icon name="camera" size={19} color={colors.text} />
            <Text style={styles.actionLabel}>Take photo</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.skipButton, uploadInProgress && styles.actionButtonDisabled]}
          onPress={finish}
          disabled={uploadInProgress}
          accessibilityRole="button"
          testID="skip-button"
        >
          <Text style={styles.skipLabel}>{origin === 'created' ? 'Skip for now' : 'Back'}</Text>
        </Pressable>

        <Pressable
          style={[styles.continueButton, hasIncompleteSelections && styles.actionButtonDisabled]}
          onPress={finish}
          disabled={hasIncompleteSelections}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          testID="finish-button"
        >
          <Text style={styles.continueLabel}>Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingLabel: {
    fontSize: 15,
    color: colors.muted,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: spacing.xl,
  },
  retryLabel: {
    color: colors.danger,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  countLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    minHeight: 168,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  placeholderText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  thumbnailCard: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPosition: {
    fontSize: 12,
    color: colors.text,
  },
  uploadedBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.greenDark,
  },
  uploadedBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.green,
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(4, 8, 11, 0.7)',
  },
  thumbnailOverlayLabel: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  thumbnailFailed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.dangerSurface,
  },
  failedText: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.danger,
    textAlign: 'center',
  },
  failedActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retryInlineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.green,
  },
  removeInlineLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  removeButton: {
    paddingVertical: 2,
  },
  removeButtonLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  permissionMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.warning,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  limitMessage: {
    fontSize: 13,
    color: colors.muted,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  skipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    marginTop: spacing.xs,
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.page,
  },
});
