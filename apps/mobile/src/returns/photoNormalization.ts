import * as ImageManipulator from 'expo-image-manipulator';

/** Mirrors the backend's independent limit (`ReturnPhotoService`) — the backend re-validates regardless. */
export const MAX_PHOTO_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Longest edge above which a selected photo is downscaled before upload. */
export const MAX_PHOTO_LONGEST_DIMENSION = 1600;

const JPEG_COMPRESSION_QUALITY = 0.8;

export class PhotoTooLargeError extends Error {
  constructor() {
    super('This photo is still too large after normalization.');
    this.name = 'PhotoTooLargeError';
  }
}

export interface NormalizedPhoto {
  uri: string;
  width: number;
  height: number;
  contentType: 'image/jpeg';
  sizeBytes: number;
}

/**
 * Normalizes a picked/captured asset to JPEG before upload: resizes only
 * when the longest dimension exceeds {@link MAX_PHOTO_LONGEST_DIMENSION}
 * (aspect ratio preserved — only one of width/height is given to the
 * resize action, so the manipulator derives the other), then compresses at
 * ~0.8 quality. This removes any dependency on the original device format
 * (HEIC, etc.) and keeps upload size predictable regardless of source.
 *
 * <p>Requests `base64` purely to measure the exact resulting byte size
 * before upload (no separate file-size API is part of this phase's
 * dependency set) — the returned {@link NormalizedPhoto.uri} is the
 * manipulator's own output file, never the base64 string itself, so upload
 * still streams the file directly rather than re-encoding it.
 */
export async function normalizePhotoToJpeg(uri: string, width: number, height: number): Promise<NormalizedPhoto> {
  const longestDimension = Math.max(width, height);
  const actions: ImageManipulator.Action[] =
    longestDimension > MAX_PHOTO_LONGEST_DIMENSION
      ? [
          {
            resize:
              width >= height ? { width: MAX_PHOTO_LONGEST_DIMENSION } : { height: MAX_PHOTO_LONGEST_DIMENSION },
          },
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_COMPRESSION_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new PhotoTooLargeError();
  }
  const sizeBytes = base64SizeInBytes(result.base64);
  if (sizeBytes > MAX_PHOTO_FILE_SIZE_BYTES) {
    throw new PhotoTooLargeError();
  }

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    contentType: 'image/jpeg',
    sizeBytes,
  };
}

function base64SizeInBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
