import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SignaturePoint, SignatureStroke } from '../returns/types';

export interface SignaturePadHandle {
  clear: () => void;
  undoLast: () => void;
}

interface Props {
  onStrokesChange: (strokes: SignatureStroke[]) => void;
  /**
   * Reports whether a finger/pointer is currently drawing inside the pad, so
   * a scrollable parent can suspend its own scrolling for exactly the
   * duration of a drawing gesture. Always reports `false` again on both
   * release and termination, so an interrupted gesture can never leave a
   * parent permanently locked.
   */
  onDrawingActiveChange?: (active: boolean) => void;
  testID?: string;
}

/**
 * Normalized (0..1) minimum distance between consecutively recorded points —
 * filters near-duplicate points from a dense gesture-move stream without
 * losing the drawn shape, so a long stroke doesn't create an excessive
 * number of nearly identical points.
 */
const MIN_POINT_DISTANCE = 0.01;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function distance(a: SignaturePoint, b: SignaturePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function strokeToPath(stroke: SignatureStroke, width: number, height: number): string {
  return stroke
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${(point.x * width).toFixed(2)} ${(point.y * height).toFixed(2)}`)
    .join(' ');
}

/**
 * Cross-platform (native + Expo Web) signature capture built on
 * `react-native-svg` and React Native's own `PanResponder` gesture
 * abstraction — deliberately not a WebView-based signature library or a
 * browser-only canvas package. Records normalized (0..1) points, not
 * pixels, so the same drawing stays valid regardless of the pad's actual
 * on-screen size (including after a layout/orientation change).
 *
 * <p>Uncontrolled: owns its strokes internally and reports every committed
 * change through {@link Props.onStrokesChange}. `Clear` and `Undo` are
 * exposed imperatively via `ref` because they're triggered by buttons
 * outside the pad's own touch area, not by props.
 *
 * <p>{@link Props.onStrokesChange} is invoked from an effect that runs
 * *after* a committed-strokes change has rendered — never from inside a
 * `setState` updater. React may run an updater during a render pass, so
 * calling a parent's setter from one updates the parent while this
 * component is rendering, which React reports as "Cannot update a component
 * while rendering a different component". Every updater here is therefore
 * pure, and the in-progress stroke is authoritative in a ref so committing
 * it on release needs no nested updater at all.
 */
const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { onStrokesChange, onDrawingActiveChange, testID },
  ref,
) {
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<SignatureStroke>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layoutRef = useRef({ width: 0, height: 0 });
  /**
   * The in-progress stroke's authoritative value. State mirrors it only so
   * the stroke renders while it is being drawn; keeping the truth in a ref
   * is what lets release commit it with one pure `setStrokes` updater
   * instead of reading it back out of a nested `setCurrentStroke` updater.
   */
  const currentStrokeRef = useRef<SignatureStroke>([]);
  const onStrokesChangeRef = useRef(onStrokesChange);
  onStrokesChangeRef.current = onStrokesChange;
  const onDrawingActiveChangeRef = useRef(onDrawingActiveChange);
  onDrawingActiveChangeRef.current = onDrawingActiveChange;
  /** The strokes value already reported to the parent — starts as the initial state, so mounting reports nothing. */
  const reportedStrokesRef = useRef(strokes);

  useEffect(() => {
    if (reportedStrokesRef.current === strokes) {
      return;
    }
    reportedStrokesRef.current = strokes;
    onStrokesChangeRef.current(strokes);
  }, [strokes]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    layoutRef.current = { width, height };
    setSize({ width, height });
  }, []);

  const toPoint = useCallback((locationX: number, locationY: number): SignaturePoint | null => {
    const { width, height } = layoutRef.current;
    if (width <= 0 || height <= 0) {
      return null;
    }
    return { x: clamp01(locationX / width), y: clamp01(locationY / height) };
  }, []);

  // Created once via useRef, not recreated on every render — every callback
  // below reads only refs or uses pure functional setState updates, so none
  // of them ever closes over a stale `strokes`/`currentStroke` value.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // A scrolling ancestor asks the current responder to hand the gesture
      // over as soon as its own native scroll starts; granting that (the
      // default) is what let the page move under a finger that was drawing.
      // The pad keeps the gesture until the finger is genuinely released or
      // the system terminates it.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const point = toPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        currentStrokeRef.current = point ? [point] : [];
        setCurrentStroke(currentStrokeRef.current);
        onDrawingActiveChangeRef.current?.(true);
      },
      onPanResponderMove: (event) => {
        const point = toPoint(event.nativeEvent.locationX, event.nativeEvent.locationY);
        if (!point) {
          return;
        }
        const previous = currentStrokeRef.current;
        const last = previous[previous.length - 1];
        if (last && distance(last, point) < MIN_POINT_DISTANCE) {
          return;
        }
        currentStrokeRef.current = [...previous, point];
        setCurrentStroke(currentStrokeRef.current);
      },
      onPanResponderRelease: () => {
        const drawn = currentStrokeRef.current;
        currentStrokeRef.current = [];
        setCurrentStroke([]);
        // A stroke with fewer than two points (a tap) is discarded rather
        // than committed — the backend would reject it anyway, and there's
        // no reason to let the driver "undo" a mark they never actually drew.
        if (drawn.length >= 2) {
          setStrokes((previous) => [...previous, drawn]);
        }
        onDrawingActiveChangeRef.current?.(false);
      },
      onPanResponderTerminate: () => {
        currentStrokeRef.current = [];
        setCurrentStroke([]);
        onDrawingActiveChangeRef.current?.(false);
      },
    }),
  ).current;

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        currentStrokeRef.current = [];
        setCurrentStroke([]);
        setStrokes([]);
      },
      undoLast: () => {
        setStrokes((previous) => previous.slice(0, -1));
      },
    }),
    [],
  );

  const visibleStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;

  return (
    <View style={styles.pad} onLayout={onLayout} testID={testID} {...panResponder.panHandlers}>
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          {visibleStrokes.map((stroke, index) => (
            <Path
              key={index}
              d={strokeToPath(stroke, size.width, size.height)}
              stroke="#111827"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
});

export default SignaturePad;

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    height: 220,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
