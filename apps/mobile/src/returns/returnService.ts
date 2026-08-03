import { Platform } from 'react-native';

import { authorizedMultipartRequest, authorizedRequestJson } from '../api/apiClient';
import type { NormalizedPhoto } from './photoNormalization';
import type { CreateReturnPayload, ReturnPhoto, ReturnRecord } from './types';

/** GET /api/v1/driver/returns — server-side tenant+driver scoping only; no client-side filtering. */
export function listReturns(): Promise<ReturnRecord[]> {
  return authorizedRequestJson<ReturnRecord[]>('/api/v1/driver/returns');
}

/** POST /api/v1/driver/returns — payload is exactly `CreateReturnPayload`, never augmented with identity fields. */
export function createReturn(payload: CreateReturnPayload): Promise<ReturnRecord> {
  return authorizedRequestJson<ReturnRecord>('/api/v1/driver/returns', { method: 'POST', body: payload });
}

/** GET /api/v1/driver/returns/{returnId} */
export function getReturn(returnId: string): Promise<ReturnRecord> {
  return authorizedRequestJson<ReturnRecord>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}`);
}

/** GET /api/v1/driver/returns/{returnId}/photos — ordered by position ascending, as the backend guarantees. */
export function listReturnPhotos(returnId: string): Promise<ReturnPhoto[]> {
  return authorizedRequestJson<ReturnPhoto[]>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}/photos`);
}

const PHOTO_FILENAME = 'photo.jpg';

/**
 * POST /api/v1/driver/returns/{returnId}/photos — multipart, exactly one
 * field named `file`. Never sends tenantId, driverId, position, or a
 * storage key: those are always server-derived from the already-normalized
 * {@link NormalizedPhoto}.
 *
 * <p>The `file` part is built differently per platform because a single
 * representation does not work on both: React Native's native `fetch`/
 * `FormData` implementation special-cases a plain `{ uri, name, type }`
 * object appended as a file part and streams the file directly, but on
 * Expo Web `fetch`/`FormData` are the browser's own APIs, which require an
 * actual `Blob`/`File` — appending a plain object there gets silently
 * coerced to a string (effectively `"[object Object]"`), producing a
 * malformed multipart request the backend correctly rejects as missing the
 * required file part. See {@link readUriAsTypedBlob} for the web-only path.
 */
export async function uploadReturnPhoto(returnId: string, photo: NormalizedPhoto): Promise<ReturnPhoto> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await readUriAsTypedBlob(photo.uri, photo.contentType);
    formData.append('file', blob, PHOTO_FILENAME);
  } else {
    formData.append('file', {
      uri: photo.uri,
      name: PHOTO_FILENAME,
      type: photo.contentType,
    } as unknown as Blob);
  }
  return authorizedMultipartRequest<ReturnPhoto>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}/photos`, formData);
}

/**
 * Web-only: reads a local/blob/data URI (whatever {@link NormalizedPhoto.uri}
 * resolves to in a browser) into a real `Blob`, via the browser's own
 * `fetch`, and stamps it with the normalized content type. `fetch` on a
 * `blob:`/`data:` URI never touches the network — it just reads the
 * in-memory or in-page data the image manipulator already produced.
 */
async function readUriAsTypedBlob(uri: string, contentType: string): Promise<Blob> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob.type === contentType ? blob : new Blob([blob], { type: contentType });
}
