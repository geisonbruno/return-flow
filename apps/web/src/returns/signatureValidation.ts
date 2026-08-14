import type { SignatureStroke } from './types';

/** Mirrors `returnrecord.SignatureStrokeValidator`'s limit exactly — the backend remains the final source of truth. */
export const SIGNER_NAME_MAX_LENGTH = 100;

/**
 * Same normalized (0..1) minimum-total-drawn-length threshold as the
 * backend's `SignatureStrokeValidator.MIN_TOTAL_PATH_LENGTH_NORMALIZED`
 * (also mirrored by `apps/mobile`'s own `signatureValidation.ts`) — kept in
 * sync manually since there is no shared contract package. Used only for
 * immediate client-side feedback; the backend independently re-validates and
 * remains authoritative.
 */
const MIN_TOTAL_PATH_LENGTH_NORMALIZED = 0.05;

export function validateSignerName(rawSignerName: string): string | undefined {
  const trimmed = rawSignerName.trim();
  if (!trimmed) {
    return 'Warehouse representative name is required.';
  }
  if (trimmed.length > SIGNER_NAME_MAX_LENGTH) {
    return `Warehouse representative name must be ${SIGNER_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

function strokeLength(stroke: SignatureStroke): number {
  let length = 0;
  for (let i = 1; i < stroke.length; i++) {
    const dx = stroke[i].x - stroke[i - 1].x;
    const dy = stroke[i].y - stroke[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/** True only once the admin has drawn enough to plausibly be a real signature, not just a tap or a barely-moved pointer. */
export function hasMeaningfulSignature(strokes: SignatureStroke[]): boolean {
  if (strokes.length === 0) {
    return false;
  }
  const totalLength = strokes.reduce((sum, stroke) => sum + strokeLength(stroke), 0);
  return totalLength >= MIN_TOTAL_PATH_LENGTH_NORMALIZED;
}
