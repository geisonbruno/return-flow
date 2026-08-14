import { forwardRef, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { SignaturePoint, SignatureStroke } from '../returns/types';

export interface WarehouseSignaturePadHandle {
  clear: () => void;
  undoLast: () => void;
}

interface WarehouseSignaturePadProps {
  onStrokesChange: (strokes: SignatureStroke[]) => void;
  disabled?: boolean;
}

/**
 * Normalized (0..1) minimum distance between consecutively recorded points —
 * filters near-duplicate points from a dense pointermove stream without
 * losing the drawn shape, mirroring `apps/mobile`'s `SignaturePad`.
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
  return stroke.map((point, index) => `${index === 0 ? 'M' : 'L'}${(point.x * width).toFixed(2)} ${(point.y * height).toFixed(2)}`).join(' ');
}

/**
 * Web-native warehouse signature capture — plain React + SVG + Pointer
 * Events (no drawing/signature dependency), the web equivalent of
 * `apps/mobile`'s `react-native-svg`/`PanResponder`-based `SignaturePad`.
 * Pointer Events unify mouse, touch, and pen input behind one event model, so
 * no separate touch-event handling is needed. Records normalized (0..1)
 * points, not pixels, so the same drawing stays valid regardless of the
 * pad's actual on-screen size.
 *
 * <p>Uncontrolled: owns its strokes internally and reports every committed
 * stroke through {@link WarehouseSignaturePadProps.onStrokesChange}. `clear`
 * and `undoLast` are exposed imperatively via `ref` because they're
 * triggered by buttons outside the pad's own drawing surface.
 */
export const WarehouseSignaturePad = forwardRef<WarehouseSignaturePadHandle, WarehouseSignaturePadProps>(
  function WarehouseSignaturePad({ onStrokesChange, disabled }, ref) {
    const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<SignatureStroke>([]);
    const svgRef = useRef<SVGSVGElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const drawingRef = useRef(false);
    const onStrokesChangeRef = useRef(onStrokesChange);
    onStrokesChangeRef.current = onStrokesChange;

    const toPoint = (clientX: number, clientY: number): SignaturePoint | null => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height) };
    };

    const measure = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
      if (disabled) {
        return;
      }
      measure();
      // Not implemented by jsdom (component tests still exercise the same
      // pointer handlers directly) — guarded rather than assumed present.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drawingRef.current = true;
      const point = toPoint(event.clientX, event.clientY);
      setCurrentStroke(point ? [point] : []);
    };

    const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!drawingRef.current) {
        return;
      }
      const point = toPoint(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      setCurrentStroke((prev) => {
        const last = prev[prev.length - 1];
        if (last && distance(last, point) < MIN_POINT_DISTANCE) {
          return prev;
        }
        return [...prev, point];
      });
    };

    const commitStroke = () => {
      if (!drawingRef.current) {
        return;
      }
      drawingRef.current = false;
      setCurrentStroke((prev) => {
        // A stroke with fewer than two points (a tap/click) is discarded
        // rather than committed — the backend would reject it anyway.
        if (prev.length >= 2) {
          setStrokes((prevStrokes) => {
            const next = [...prevStrokes, prev];
            onStrokesChangeRef.current(next);
            return next;
          });
        }
        return [];
      });
    };

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          setStrokes([]);
          setCurrentStroke([]);
          onStrokesChangeRef.current([]);
        },
        undoLast: () => {
          setStrokes((prev) => {
            const next = prev.slice(0, -1);
            onStrokesChangeRef.current(next);
            return next;
          });
        },
      }),
      [],
    );

    const visibleStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes;

    return (
      <svg
        ref={svgRef}
        className={`warehouse-signature-pad${disabled ? ' warehouse-signature-pad--disabled' : ''}`}
        aria-label="Warehouse signature drawing area"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitStroke}
        onPointerCancel={commitStroke}
        onPointerLeave={(event) => {
          // A captured pointer keeps reporting move/up events even once it
          // physically leaves the element, so this only fires for an
          // uncaptured pointer (e.g. `disabled`) — nothing to commit there.
          if (drawingRef.current && event.buttons === 0) {
            commitStroke();
          }
        }}
      >
        {size.width > 0 &&
          size.height > 0 &&
          visibleStrokes.map((stroke, index) => (
            <path
              key={index}
              d={strokeToPath(stroke, size.width, size.height)}
              stroke="#111827"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
      </svg>
    );
  },
);
