import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme/tokens';

/** The guided return-creation flow, in order. */
export const RETURN_FLOW_STEPS = ['Details', 'Photos', 'Signature', 'Review'] as const;

export type ReturnFlowStep = (typeof RETURN_FLOW_STEPS)[number];

interface Props {
  /** 1-based position of the screen currently on show. */
  currentStep: number;
  steps?: readonly string[];
}

/**
 * The four-step progress indicator for the return-creation flow.
 *
 * <p>It is a pure presentation component: each screen passes the step it
 * represents, so the indicator mirrors the existing navigation rather than
 * introducing a parallel wizard state machine. The stack remains the source of
 * truth for where the driver actually is.
 *
 * <p>State is never carried by colour alone — every step announces its
 * position and whether it is completed, current or upcoming, and completed
 * steps are additionally marked with a check rather than just a green fill.
 */
export default function StepIndicator({ currentStep, steps = RETURN_FLOW_STEPS }: Props) {
  return (
    <View style={styles.container} testID="step-indicator">
      {/* The rail behind the markers; the markers paint over it. */}
      <View style={styles.track} pointerEvents="none" />

      <View style={styles.row}>
        {steps.map((label, index) => {
          const position = index + 1;
          const completed = position < currentStep;
          const current = position === currentStep;
          const state = completed ? 'completed' : current ? 'current' : 'upcoming';

          return (
            <View
              key={label}
              style={styles.step}
              accessible
              accessibilityRole="text"
              accessibilityState={{ selected: current }}
              accessibilityLabel={`Step ${position} of ${steps.length}, ${label}, ${state}`}
              testID={`step-${position}`}
            >
              <View style={[styles.marker, completed && styles.markerCompleted, current && styles.markerCurrent]}>
                {/* The wrapper is `accessible`, so a screen reader reads its
                    combined label ("Step 2 of 4, Photos, upcoming") rather than
                    these children individually. */}
                <Text style={[styles.markerLabel, completed && styles.markerLabelCompleted, current && styles.markerLabelCurrent]}>
                  {completed ? '✓' : position}
                </Text>
              </View>
              <Text
                style={[styles.label, current && styles.labelCurrent, completed && styles.labelCompleted]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const MARKER_SIZE = 30;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  track: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: spacing.sm + MARKER_SIZE / 2 - 1,
    height: 2,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  markerCompleted: {
    borderColor: colors.green,
    backgroundColor: colors.greenDark,
  },
  markerCurrent: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  markerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  /** Dark ink on the solid green current marker. */
  markerLabelCurrent: {
    color: colors.page,
  },
  /** Green on the dark completed fill — the reverse pairing needs its own colour. */
  markerLabelCompleted: {
    color: colors.green,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  labelCurrent: {
    color: colors.text,
    fontWeight: '700',
  },
  labelCompleted: {
    color: colors.green,
  },
});
