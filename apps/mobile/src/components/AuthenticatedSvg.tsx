import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { authorizedMediaText } from '../api/apiClient';
import { colors, radius, spacing } from '../theme/tokens';

type State = { status: 'loading' } | { status: 'ready'; xml: string } | { status: 'failed' };

interface Props {
  /** The API-relative `contentPath` the backend returned — never a public URL. */
  contentPath: string;
  accessibilityLabel: string;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Renders a private SVG document from an authenticated content endpoint.
 *
 * <p>The customer signature is a sanitized, server-generated SVG (root
 * `CLAUDE.md` §13.1), which React Native's `Image` cannot decode on a device.
 * It is therefore fetched as markup through the app's own API client — the
 * bearer token stays in the Authorization header and never reaches a URL — and
 * drawn with the `react-native-svg` the project already depends on, the same
 * library `SignaturePad` uses. No new dependency, and the markup is never
 * treated as HTML.
 *
 * <p>Failure is contained: an unreadable signature shows a restrained note
 * rather than blanking the screen around it.
 */
export default function AuthenticatedSvg({ contentPath, accessibilityLabel, width, height, style, testID }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((previous) => (previous.status === 'loading' ? previous : { status: 'loading' }));
      try {
        const xml = await authorizedMediaText(contentPath);
        if (!cancelled) {
          setState({ status: 'ready', xml });
        }
      } catch {
        // Deliberately no detail: a media failure never surfaces backend text.
        if (!cancelled) {
          setState({ status: 'failed' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentPath]);

  if (state.status === 'ready') {
    return (
      <View
        style={[styles.frame, { width, height }, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        <SvgXml xml={state.xml} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <View
      style={[styles.frame, { width, height }, style]}
      accessible
      accessibilityLabel={
        state.status === 'failed' ? `${accessibilityLabel}, could not be loaded` : `${accessibilityLabel}, loading`
      }
      testID={testID ? `${testID}-${state.status}` : undefined}
    >
      {state.status === 'failed' ? (
        <Text style={styles.fallbackLabel}>Signature unavailable</Text>
      ) : (
        <ActivityIndicator color={colors.muted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fallbackLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
});
