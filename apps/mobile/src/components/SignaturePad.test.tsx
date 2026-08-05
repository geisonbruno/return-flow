import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { createRef } from 'react';

import type { SignatureStroke } from '../returns/types';
import SignaturePad from './SignaturePad';
import type { SignaturePadHandle } from './SignaturePad';

function layout(width = 300, height = 200) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height } } };
}

// PanResponder's internal gesture-state computation reads `touchHistory` off
// the top level of a GestureResponderEvent (react-native's
// ResponderEventPlugin attaches it there, not nested inside `nativeEvent`)
// even for a single synthetic touch driven directly through fireEvent — an
// empty-but-valid touch bank satisfies TouchHistoryMath without simulating a
// real touch stream. `mostRecentTimeStamp` must strictly increase between
// calls: PanResponder's onResponderMove silently no-ops whenever it equals
// gestureState's internally tracked `_accountsForMovesUpTo` (initialized to
// 0), so a constant/repeated timestamp would make every move event a no-op.
let nextTimeStamp = 1;

function touch(locationX: number, locationY: number) {
  return {
    nativeEvent: { locationX, locationY },
    touchHistory: { touchBank: [], numberActiveTouches: 0, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: nextTimeStamp++ },
  };
}

describe('SignaturePad', () => {
  it('reports a committed stroke with normalized (0..1) points after a drag gesture', () => {
    const onStrokesChange = jest.fn();
    render(<SignaturePad testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout(300, 200));
    fireEvent(pad, 'responderGrant', touch(30, 100)); // 30/300=0.1, 100/200=0.5
    fireEvent(pad, 'responderMove', touch(60, 80)); // 60/300=0.2, 80/200=0.4
    fireEvent(pad, 'responderRelease', {});

    expect(onStrokesChange).toHaveBeenCalledTimes(1);
    const strokes: SignatureStroke[] = onStrokesChange.mock.calls[0][0];
    expect(strokes).toHaveLength(1);
    expect(strokes[0][0]).toEqual({ x: 0.1, y: 0.5 });
    expect(strokes[0][strokes[0].length - 1]).toEqual({ x: 0.2, y: 0.4 });
  });

  it('clamps coordinates to 0..1 even when a drag moves outside the pad bounds', () => {
    const onStrokesChange = jest.fn();
    render(<SignaturePad testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout(300, 200));
    fireEvent(pad, 'responderGrant', touch(-50, -50));
    fireEvent(pad, 'responderMove', touch(1000, 1000));
    fireEvent(pad, 'responderRelease', {});

    const strokes: SignatureStroke[] = onStrokesChange.mock.calls[0][0];
    for (const stroke of strokes) {
      for (const point of stroke) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('does not commit a stroke from a single tap (one point)', () => {
    const onStrokesChange = jest.fn();
    render(<SignaturePad testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout());
    fireEvent(pad, 'responderGrant', touch(30, 100));
    fireEvent(pad, 'responderRelease', {});

    expect(onStrokesChange).not.toHaveBeenCalled();
  });

  it('filters near-duplicate points from a dense move stream without losing the real shape', () => {
    const onStrokesChange = jest.fn();
    render(<SignaturePad testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout(300, 200));
    fireEvent(pad, 'responderGrant', touch(0, 0));
    for (let i = 0; i < 20; i++) {
      fireEvent(pad, 'responderMove', touch(i * 0.1, 0));
    }
    fireEvent(pad, 'responderMove', touch(150, 0));
    fireEvent(pad, 'responderRelease', {});

    const strokes: SignatureStroke[] = onStrokesChange.mock.calls[0][0];
    expect(strokes[0].length).toBeLessThan(10);
    expect(strokes[0][strokes[0].length - 1].x).toBeCloseTo(0.5, 2);
  });

  it('handles a layout-size change safely without corrupting already-normalized data', () => {
    const onStrokesChange = jest.fn();
    render(<SignaturePad testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout(300, 200));
    fireEvent(pad, 'responderGrant', touch(30, 100));
    fireEvent(pad, 'responderMove', touch(60, 80));
    fireEvent(pad, 'responderRelease', {});

    // Orientation change / resize — already-committed points stay normalized (0..1), independent of pixel size.
    fireEvent(pad, 'layout', layout(600, 400));

    const strokes: SignatureStroke[] = onStrokesChange.mock.calls[0][0];
    expect(strokes[0][0]).toEqual({ x: 0.1, y: 0.5 });
  });

  it('Clear removes every committed stroke', () => {
    const onStrokesChange = jest.fn();
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');

    fireEvent(pad, 'layout', layout());
    fireEvent(pad, 'responderGrant', touch(10, 10));
    fireEvent(pad, 'responderMove', touch(50, 50));
    fireEvent(pad, 'responderRelease', {});

    act(() => {
      ref.current?.clear();
    });

    expect(onStrokesChange).toHaveBeenLastCalledWith([]);
  });

  it('Undo removes only the last committed stroke', () => {
    const onStrokesChange = jest.fn();
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} testID="pad" onStrokesChange={onStrokesChange} />);
    const pad = screen.getByTestId('pad');
    fireEvent(pad, 'layout', layout());

    fireEvent(pad, 'responderGrant', touch(10, 10));
    fireEvent(pad, 'responderMove', touch(50, 50));
    fireEvent(pad, 'responderRelease', {});

    fireEvent(pad, 'responderGrant', touch(60, 60));
    fireEvent(pad, 'responderMove', touch(90, 90));
    fireEvent(pad, 'responderRelease', {});

    const beforeUndo = onStrokesChange.mock.calls[onStrokesChange.mock.calls.length - 1][0];
    expect(beforeUndo).toHaveLength(2);

    act(() => {
      ref.current?.undoLast();
    });

    const afterUndo = onStrokesChange.mock.calls[onStrokesChange.mock.calls.length - 1][0];
    expect(afterUndo).toHaveLength(1);
  });
});
