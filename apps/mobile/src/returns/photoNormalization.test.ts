import * as ImageManipulator from 'expo-image-manipulator';

import { MAX_PHOTO_LONGEST_DIMENSION, PhotoTooLargeError, normalizePhotoToJpeg } from './photoNormalization';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

const manipulateAsyncMock = ImageManipulator.manipulateAsync as jest.Mock;

/** ~4/3 bytes per base64 char; small strings are enough to exercise the byte-size math. */
function base64OfLength(charCount: number): string {
  return 'A'.repeat(charCount);
}

describe('normalizePhotoToJpeg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resizes when the longest dimension exceeds the maximum, preserving aspect ratio via a single-dimension resize action', async () => {
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///resized.jpg', width: 1600, height: 1200, base64: base64OfLength(400) });

    await normalizePhotoToJpeg('file:///original.jpg', 3200, 2400);

    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      'file:///original.jpg',
      [{ resize: { width: MAX_PHOTO_LONGEST_DIMENSION } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('resizes by height when the image is taller than it is wide', async () => {
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///resized.jpg', width: 900, height: 1600, base64: base64OfLength(400) });

    await normalizePhotoToJpeg('file:///original.jpg', 1800, 3200);

    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      'file:///original.jpg',
      [{ resize: { height: MAX_PHOTO_LONGEST_DIMENSION } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('does not resize a smaller image — dimensions and content are preserved', async () => {
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///same-size.jpg', width: 800, height: 600, base64: base64OfLength(400) });

    const result = await normalizePhotoToJpeg('file:///original.jpg', 800, 600);

    expect(manipulateAsyncMock).toHaveBeenCalledWith('file:///original.jpg', [], expect.objectContaining({ format: 'jpeg' }));
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('always outputs JPEG, with the correct content type, regardless of the source format (HEIC or otherwise)', async () => {
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///converted.jpg', width: 800, height: 600, base64: base64OfLength(400) });

    const result = await normalizePhotoToJpeg('file:///original.heic', 800, 600);

    expect(result.contentType).toBe('image/jpeg');
    expect(manipulateAsyncMock).toHaveBeenCalledWith(
      'file:///original.heic',
      expect.any(Array),
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('rejects a normalized file that is still larger than 5 MB', async () => {
    // ~4/3 bytes per base64 char, so ~7,000,000 chars ≈ 5.25 MB of decoded bytes.
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///huge.jpg', width: 1600, height: 1200, base64: base64OfLength(7_000_000) });

    await expect(normalizePhotoToJpeg('file:///original.jpg', 4000, 3000)).rejects.toBeInstanceOf(PhotoTooLargeError);
  });

  it('accepts a normalized file at or under 5 MB', async () => {
    manipulateAsyncMock.mockResolvedValue({ uri: 'file:///ok.jpg', width: 1600, height: 1200, base64: base64OfLength(4000) });

    const result = await normalizePhotoToJpeg('file:///original.jpg', 4000, 3000);

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.sizeBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
});
