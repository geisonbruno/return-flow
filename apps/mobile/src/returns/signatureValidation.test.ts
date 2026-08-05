import { hasMeaningfulSignature, SIGNER_NAME_MAX_LENGTH, validateSignerName } from './signatureValidation';
import type { SignatureStroke } from './types';

describe('validateSignerName', () => {
  it('requires a non-blank name', () => {
    expect(validateSignerName('')).toBe('Signer name is required.');
    expect(validateSignerName('   ')).toBe('Signer name is required.');
  });

  it('rejects a name over the maximum length', () => {
    expect(validateSignerName('A'.repeat(SIGNER_NAME_MAX_LENGTH + 1))).toBeTruthy();
  });

  it('accepts a valid trimmed name', () => {
    expect(validateSignerName('  John Smith  ')).toBeUndefined();
  });
});

describe('hasMeaningfulSignature', () => {
  it('rejects no strokes at all', () => {
    expect(hasMeaningfulSignature([])).toBe(false);
  });

  it('rejects a single tap (one point)', () => {
    const strokes: SignatureStroke[] = [[{ x: 0.5, y: 0.5 }]];
    expect(hasMeaningfulSignature(strokes)).toBe(false);
  });

  it('rejects two coincident points as an effectively blank stroke', () => {
    const strokes: SignatureStroke[] = [[{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }]];
    expect(hasMeaningfulSignature(strokes)).toBe(false);
  });

  it('rejects a barely-moved drawing below the minimum drawn length', () => {
    const strokes: SignatureStroke[] = [[{ x: 0.5, y: 0.5 }, { x: 0.5001, y: 0.5 }]];
    expect(hasMeaningfulSignature(strokes)).toBe(false);
  });

  it('accepts a short but real signature', () => {
    const strokes: SignatureStroke[] = [
      [{ x: 0.1, y: 0.5 }, { x: 0.2, y: 0.4 }, { x: 0.35, y: 0.55 }, { x: 0.5, y: 0.35 }],
    ];
    expect(hasMeaningfulSignature(strokes)).toBe(true);
  });

  it('accepts several short strokes whose combined length passes the threshold', () => {
    const strokes: SignatureStroke[] = [
      [{ x: 0.1, y: 0.1 }, { x: 0.15, y: 0.15 }],
      [{ x: 0.3, y: 0.3 }, { x: 0.35, y: 0.35 }],
      [{ x: 0.5, y: 0.5 }, { x: 0.55, y: 0.55 }],
    ];
    expect(hasMeaningfulSignature(strokes)).toBe(true);
  });
});
