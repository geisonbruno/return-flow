import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { authorizedMultipartRequest, authorizedRequestJson } from '../api/apiClient';
import type { NormalizedPhoto } from './photoNormalization';
import type { CreateReturnPayload, CreateReturnSignaturePayload, ReturnPhoto, ReturnRecord, ReturnSignature } from './types';

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
 * representation does not work on both. On web, `FormData` is the browser's
 * own API and needs a real `Blob`/`File` (see {@link readUriAsTypedBlob}).
 *
 * <p>On native the part must be something the *active* `fetch` can actually
 * read the bytes of. It deliberately is NOT React Native's proprietary
 * `{ uri, name, type }` file descriptor: since Expo SDK 54 the Expo runtime
 * replaces the global `fetch` with `expo/fetch`, whose multipart encoder
 * only understands a string, a `Blob`, or an object exposing `bytes()` —
 * an RN file descriptor makes it throw `Unsupported FormDataPart
 * implementation` *before any request is sent*, which the API client can
 * only report as a connection failure. `expo-file-system`'s `File`
 * implements the `Blob` interface over a local URI, so the encoder reads
 * the file itself and the request is a normal, well-formed multipart POST.
 * Do not reintroduce the `{ uri, name, type }` form here.
 *
 * <p>No explicit filename is passed on native: the part's `filename` comes
 * from `File.name`, which is the image manipulator's own generated
 * `<random>.jpg` cache name. It carries no user data, and the backend
 * ignores it anyway — storage keys are always server-generated.
 */
export async function uploadReturnPhoto(returnId: string, photo: NormalizedPhoto): Promise<ReturnPhoto> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await readUriAsTypedBlob(photo.uri, photo.contentType);
    formData.append('file', blob, PHOTO_FILENAME);
  } else {
    formData.append('file', new File(photo.uri) as unknown as Blob);
  }
  return authorizedMultipartRequest<ReturnPhoto>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}/photos`, formData);
}

/**
 * POST /api/v1/driver/returns/{returnId}/signature — payload is exactly
 * `CreateReturnSignaturePayload` (signer name + normalized stroke points),
 * never a client-generated image, Base64, storage key, or timestamp.
 */
export function createReturnSignature(returnId: string, payload: CreateReturnSignaturePayload): Promise<ReturnSignature> {
  return authorizedRequestJson<ReturnSignature>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}/signature`, {
    method: 'POST',
    body: payload,
  });
}

/** GET /api/v1/driver/returns/{returnId}/signature — 404 (via `ApiError`) when the return has no signature yet. */
export function getReturnSignature(returnId: string): Promise<ReturnSignature> {
  return authorizedRequestJson<ReturnSignature>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}/signature`);
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
