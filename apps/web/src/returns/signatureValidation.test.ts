import { describe, expect, it } from 'vitest';

import { SIGNER_NAME_MAX_LENGTH, hasMeaningfulSignature, validateSignerName } from './signatureValidation';
import type { SignatureStroke } from './types';

describe('validateSignerName', () => {
  it('rejects a blank name', () => {
    expect(validateSignerName('')).toBe('Warehouse representative name is required.');
    expect(validateSignerName('   ')).toBe('Warehouse representative name is required.');
  });

  it('rejects a name over the max length', () => {
    const tooLong = 'a'.repeat(SIGNER_NAME_MAX_LENGTH + 1);
    expect(validateSignerName(tooLong)).toBe(`Warehouse representative name must be ${SIGNER_NAME_MAX_LENGTH} characters or fewer.`);
  });

  it('accepts a valid trimmed name', () => {
    expect(validateSignerName('  Jane Warehouse  ')).toBeUndefined();
  });
});

describe('hasMeaningfulSignature', () => {
  it('is false with no strokes', () => {
    expect(hasMeaningfulSignature([])).toBe(false);
  });

  it('is false for a barely-moved stroke below the minimum drawn length', () => {
    const strokes: SignatureStroke[] = [
      [
        { x: 0.5, y: 0.5 },
        { x: 0.5001, y: 0.5001 },
      ],
    ];
    expect(hasMeaningfulSignature(strokes)).toBe(false);
  });

  it('is true for a real drawn stroke', () => {
    const strokes: SignatureStroke[] = [
      [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
        { x: 0.9, y: 0.2 },
      ],
    ];
    expect(hasMeaningfulSignature(strokes)).toBe(true);
  });

  it('sums drawn length across multiple strokes', () => {
    const strokes: SignatureStroke[] = [
      [
        { x: 0, y: 0 },
        { x: 0.03, y: 0 },
      ],
      [
        { x: 0.5, y: 0.5 },
        { x: 0.53, y: 0.5 },
      ],
    ];
    expect(hasMeaningfulSignature(strokes)).toBe(true);
  });
});
