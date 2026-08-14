import { act, createRef } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WarehouseSignaturePad, type WarehouseSignaturePadHandle } from './WarehouseSignaturePad';
import type { SignatureStroke } from '../returns/types';

/** jsdom's `getBoundingClientRect` (defined on `Element.prototype`, not `SVGElement.prototype`) always returns zeros — stub a real-looking rect so normalized coordinates can be computed. */
function stubBoundingRect() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 300,
    bottom: 150,
    width: 300,
    height: 150,
    toJSON: () => ({}),
  });
}

describe('WarehouseSignaturePad', () => {
  beforeEach(() => {
    stubBoundingRect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Dispatched directly via `element.dispatchEvent` (not through a React
  // synthetic handler triggered by `fireEvent`), so the resulting state
  // update is scheduled outside of React's automatic `act()` batching —
  // wrapped here so the update is guaranteed to flush before the next
  // assertion runs, exactly like every other interaction test in this app.
  function dispatchPointer(element: SVGSVGElement, type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number, clientY: number) {
    act(() => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }) as unknown as PointerEvent;
      Object.defineProperty(event, 'pointerId', { value: 1 });
      element.dispatchEvent(event);
    });
  }

  it('reports a committed stroke after a drag gesture', () => {
    const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
    const { container } = render(<WarehouseSignaturePad onStrokesChange={onStrokesChange} />);
    const svg = container.querySelector('svg') as SVGSVGElement;

    dispatchPointer(svg, 'pointerdown', 10, 10);
    dispatchPointer(svg, 'pointermove', 100, 80);
    dispatchPointer(svg, 'pointerup', 100, 80);

    expect(onStrokesChange).toHaveBeenCalled();
    const lastCall = onStrokesChange.mock.calls.at(-1)?.[0];
    expect(lastCall).toHaveLength(1);
    expect(lastCall?.[0].length).toBeGreaterThanOrEqual(2);
  });

  it('discards a tap (fewer than two points) as a stroke', () => {
    const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
    const { container } = render(<WarehouseSignaturePad onStrokesChange={onStrokesChange} />);
    const svg = container.querySelector('svg') as SVGSVGElement;

    dispatchPointer(svg, 'pointerdown', 50, 50);
    dispatchPointer(svg, 'pointerup', 50, 50);

    expect(onStrokesChange).not.toHaveBeenCalled();
  });

  it('clear() removes every stroke and reports an empty array', () => {
    const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
    const ref = createRef<WarehouseSignaturePadHandle>();
    const { container } = render(<WarehouseSignaturePad ref={ref} onStrokesChange={onStrokesChange} />);
    const svg = container.querySelector('svg') as SVGSVGElement;

    dispatchPointer(svg, 'pointerdown', 10, 10);
    dispatchPointer(svg, 'pointermove', 90, 90);
    dispatchPointer(svg, 'pointerup', 90, 90);
    expect(onStrokesChange.mock.calls.at(-1)?.[0]).toHaveLength(1);

    act(() => {
      ref.current?.clear();
    });
    expect(onStrokesChange.mock.calls.at(-1)?.[0]).toEqual([]);
  });

  it('undoLast() removes only the most recent stroke', () => {
    const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
    const ref = createRef<WarehouseSignaturePadHandle>();
    const { container } = render(<WarehouseSignaturePad ref={ref} onStrokesChange={onStrokesChange} />);
    const svg = container.querySelector('svg') as SVGSVGElement;

    dispatchPointer(svg, 'pointerdown', 10, 10);
    dispatchPointer(svg, 'pointermove', 90, 90);
    dispatchPointer(svg, 'pointerup', 90, 90);

    dispatchPointer(svg, 'pointerdown', 20, 20);
    dispatchPointer(svg, 'pointermove', 80, 40);
    dispatchPointer(svg, 'pointerup', 80, 40);

    expect(onStrokesChange.mock.calls.at(-1)?.[0]).toHaveLength(2);

    act(() => {
      ref.current?.undoLast();
    });
    expect(onStrokesChange.mock.calls.at(-1)?.[0]).toHaveLength(1);
  });

  it('ignores pointer events while disabled', () => {
    const onStrokesChange = vi.fn<(strokes: SignatureStroke[]) => void>();
    const { container } = render(<WarehouseSignaturePad onStrokesChange={onStrokesChange} disabled />);
    const svg = container.querySelector('svg') as SVGSVGElement;

    dispatchPointer(svg, 'pointerdown', 10, 10);
    dispatchPointer(svg, 'pointermove', 90, 90);
    dispatchPointer(svg, 'pointerup', 90, 90);

    expect(onStrokesChange).not.toHaveBeenCalled();
  });
});
