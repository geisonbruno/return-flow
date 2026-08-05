import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toSafeErrorMessage } from '../api/problemDetails';
import type { RootStackParamList } from '../navigation/types';
import { normalizePhotoToJpeg } from '../returns/photoNormalization';
import type { NormalizedPhoto } from '../returns/photoNormalization';
import { listReturnPhotos, uploadReturnPhoto } from '../returns/returnService';
import type { ReturnPhoto } from '../returns/types';

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
  // Finish means "every selected photo is actually uploaded" — a failed or
  // still-pending item must keep Finish disabled, not just an active upload.
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
  const finish = useCallback(() => {
    if (origin === 'created') {
      navigation.replace('CustomerSignature', { returnId });
    } else {
      navigation.replace('ReturnDetails', { returnId });
    }
  }, [navigation, origin, returnId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingLabel}>Loading photos…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadExistingPhotos()} accessibilityRole="button">
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          {origin === 'created'
            ? 'Your return has been created. Add photos now, or skip and add them later.'
            : 'Add more photos to this return, or go back when you’re done.'}
        </Text>
        <Text style={styles.countLabel} testID="photo-count">
          {uploadedCount} of {MAX_PHOTOS} photos uploaded
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, (!canAddMore || picking) && styles.actionButtonDisabled]}
            onPress={() => void pickFromLibrary()}
            disabled={!canAddMore || picking}
            accessibilityRole="button"
            testID="add-from-library-button"
          >
            <Text style={styles.actionLabel}>Add from library</Text>
          </Pressable>
          {Platform.OS !== 'web' ? (
            <Pressable
              style={[styles.actionButton, (!canAddMore || picking) && styles.actionButtonDisabled]}
              onPress={() => void takePhoto()}
              disabled={!canAddMore || picking}
              accessibilityRole="button"
              testID="take-photo-button"
            >
              <Text style={styles.actionLabel}>Take photo</Text>
            </Pressable>
          ) : null}
        </View>

        {permissionMessage ? <Text style={styles.permissionMessage}>{permissionMessage}</Text> : null}
        {!canAddMore ? <Text style={styles.limitMessage}>You have reached the five-photo limit.</Text> : null}

        <View style={styles.thumbnailGrid}>
          {uploadedPhotos.map((photo) => (
            <View key={photo.id} style={styles.thumbnailCard} testID={`uploaded-photo-${photo.position}`}>
              <View style={styles.uploadedBadge}>
                <Text style={styles.uploadedBadgeLabel}>Uploaded</Text>
              </View>
              <Text style={styles.thumbnailPosition}>Photo {photo.position}</Text>
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

        <View style={styles.footerRow}>
          <Pressable
            style={[styles.footerButton, uploadInProgress && styles.actionButtonDisabled]}
            onPress={finish}
            disabled={uploadInProgress}
            accessibilityRole="button"
            testID="skip-button"
          >
            <Text style={styles.footerButtonLabel}>{origin === 'created' ? 'Skip for now' : 'Back'}</Text>
          </Pressable>
          <Pressable
            style={[styles.footerButton, styles.finishButton, hasIncompleteSelections && styles.actionButtonDisabled]}
            onPress={finish}
            disabled={hasIncompleteSelections}
            accessibilityRole="button"
            testID="finish-button"
          >
            <Text style={[styles.footerButtonLabel, styles.finishButtonLabel]}>Finish</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingLabel: {
    fontSize: 15,
    color: '#4B5563',
  },
  errorText: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryLabel: {
    color: '#2563EB',
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#374151',
  },
  countLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  permissionMessage: {
    fontSize: 14,
    color: '#B91C1C',
  },
  limitMessage: {
    fontSize: 14,
    color: '#6B7280',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbnailCard: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  thumbnailOverlayLabel: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  thumbnailFailed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(185,28,28,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 6,
  },
  failedText: {
    color: '#FFFFFF',
    fontSize: 10,
    textAlign: 'center',
  },
  failedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  retryInlineLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  removeInlineLabel: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeButtonLabel: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  uploadedBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  uploadedBadgeLabel: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
  },
  thumbnailPosition: {
    marginTop: 6,
    fontSize: 12,
    color: '#374151',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  footerButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  finishButton: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  footerButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  finishButtonLabel: {
    color: '#FFFFFF',
  },
});
