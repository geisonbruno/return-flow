import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { authorizedMediaRequest } from '../api/apiClient';
import { colors, radius, spacing } from '../theme/tokens';

type State =
  | { status: 'loading' }
  | { status: 'ready'; uri: string }
  | { status: 'failed' };

/**
 * Turns fetched bytes into something `Image` can render on both targets.
 *
 * <p>`URL.createObjectURL` is the cheaper option and exists on Expo Web, but
 * React Native has no implementation of it, so native falls back to a data URL
 * via `FileReader`. The caller is told which kind it got, because only an
 * object URL needs revoking afterwards.
 */
async function toDisplayableUri(blob: Blob): Promise<{ uri: string; isObjectUrl: boolean }> {
  const createObjectURL = typeof URL !== 'undefined' ? URL.createObjectURL : undefined;
  if (typeof createObjectURL === 'function') {
    try {
      return { uri: createObjectURL(blob), isObjectUrl: true };
    } catch {
      // Environments that expose the symbol without implementing it fall
      // through to the data-URL path below rather than failing the image.
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image data.'));
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
  return { uri: dataUrl, isObjectUrl: false };
}

interface Props {
  /** The API-relative `contentPath` the backend returned — never a public URL. */
  contentPath: string;
  accessibilityLabel: string;
  /** Sized by the caller; the loading and failure tiles take the same box. */
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

/**
 * Renders a private image from an authenticated content endpoint.
 *
 * <p>The bytes are fetched through the app's own API client, so the bearer
 * token travels in the Authorization header and never appears in a URL, no
 * storage key is exposed, and no public media endpoint exists. The resolved
 * URI is local to the device or document, not a remote authenticated address
 * handed to `Image`, which could not carry the header.
 *
 * <p>Failure is contained: a failed load shows a compact retry tile and never
 * propagates, so one unreachable photo can never blank the screen it sits on.
 */
export default function AuthenticatedImage({ contentPath, accessibilityLabel, style, testID }: Props) {
  // The loading and failure tiles are Views, so they need the caller's box
  // expressed as a view style. Only sizing/radius is ever passed, which both
  // style shapes share.
  const boxStyle = style as StyleProp<ViewStyle>;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  /** Revoked on unmount/refetch, but only when we actually created an object URL. */
  const objectUrlRef = useRef<string | null>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {
        // Releasing is best-effort; a failure here must never surface.
      }
    }
    objectUrlRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Reset inside the async body, and only when the status would actually
      // change: returning the previous object lets React bail out, so a first
      // mount costs no extra render and a re-fetch still shows its spinner.
      setState((previous) => (previous.status === 'loading' ? previous : { status: 'loading' }));
      try {
        const blob = await authorizedMediaRequest(contentPath);
        const { uri, isObjectUrl } = await toDisplayableUri(blob);
        if (cancelled) {
          if (isObjectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(uri);
          }
          return;
        }
        releaseObjectUrl();
        objectUrlRef.current = isObjectUrl ? uri : null;
        setState({ status: 'ready', uri });
      } catch {
        // Deliberately no detail: a media failure is shown as a retryable
        // tile, never as backend text.
        if (!cancelled) {
          setState({ status: 'failed' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentPath, attempt, releaseObjectUrl]);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  if (state.status === 'ready') {
    return (
      <Image
        source={{ uri: state.uri }}
        style={[styles.image, style]}
        // `cover` fills the compact square without distorting the photo.
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      />
    );
  }

  if (state.status === 'failed') {
    return (
      <Pressable
        style={[styles.fallback, boxStyle]}
        onPress={() => setAttempt((value) => value + 1)}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}, could not be loaded. Tap to retry.`}
        testID={testID ? `${testID}-failed` : undefined}
      >
        <Text style={styles.fallbackLabel}>Tap to retry</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.fallback, boxStyle]}
      accessible
      accessibilityLabel={`${accessibilityLabel}, loading`}
      testID={testID ? `${testID}-loading` : undefined}
    >
      <ActivityIndicator color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
});
