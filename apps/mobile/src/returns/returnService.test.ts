import { Platform } from 'react-native';

import { authorizedMultipartRequest, authorizedRequestJson } from '../api/apiClient';
import { createReturnSignature, getReturnSignature, listReturnPhotos, uploadReturnPhoto } from './returnService';
import type { NormalizedPhoto } from './photoNormalization';
import type { CreateReturnSignaturePayload } from './types';

jest.mock('../api/apiClient');

const NORMALIZED: NormalizedPhoto = {
  uri: 'file:///tmp/normalized.jpg',
  width: 1200,
  height: 900,
  contentType: 'image/jpeg',
  sizeBytes: 123456,
};

const ORIGINAL_PLATFORM_OS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('uploadReturnPhoto — native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('ios');
  });

  afterAll(() => {
    setPlatform(ORIGINAL_PLATFORM_OS);
  });

  it('uploads via multipart/form-data to the correct path', async () => {
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });

    await uploadReturnPhoto('return-1', NORMALIZED);

    expect(authorizedMultipartRequest).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/photos', expect.any(FormData));
  });

  it('sends exactly one multipart field named "file", using the RN { uri, name, type } file representation unchanged', async () => {
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    expect(appendSpy).toHaveBeenCalledTimes(1);
    const [fieldName, value] = appendSpy.mock.calls[0];
    expect(fieldName).toBe('file');
    expect(value).toMatchObject({ uri: NORMALIZED.uri, name: 'photo.jpg', type: 'image/jpeg' });
  });

  it('never sends tenantId, driverId, position, or a storage key', async () => {
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    const fieldNames = appendSpy.mock.calls.map(([name]) => name);
    expect(fieldNames).toEqual(['file']);
    expect(fieldNames).not.toContain('tenantId');
    expect(fieldNames).not.toContain('driverId');
    expect(fieldNames).not.toContain('position');
    expect(fieldNames).not.toContain('storageKey');
  });

  it('never uses Base64 to carry the file', async () => {
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    const [, value] = appendSpy.mock.calls[0];
    expect(typeof value === 'string' ? value : JSON.stringify(value)).not.toMatch(/^data:.*base64/);
  });

  it('propagates a safe rejection when the upload fails', async () => {
    (authorizedMultipartRequest as jest.Mock).mockRejectedValue(new Error('raw backend detail that must never be shown'));

    await expect(uploadReturnPhoto('return-1', NORMALIZED)).rejects.toThrow();
  });
});

describe('uploadReturnPhoto — Expo Web', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('web');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    setPlatform(ORIGINAL_PLATFORM_OS);
  });

  function mockFetchBlob(blob: Blob) {
    globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) } as unknown as Response);
  }

  it('reads the normalized image URI into a real Blob rather than appending an RN-style object', async () => {
    const sourceBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    mockFetchBlob(sourceBlob);
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    expect(globalThis.fetch).toHaveBeenCalledWith(NORMALIZED.uri);
    const [, value] = appendSpy.mock.calls[0];
    expect(value).toBeInstanceOf(Blob);
    expect(value).not.toHaveProperty('uri');
  });

  it('sends the file field with a safe filename', async () => {
    mockFetchBlob(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    const [fieldName, , filename] = appendSpy.mock.calls[0];
    expect(fieldName).toBe('file');
    expect(filename).toBe('photo.jpg');
  });

  it('stamps the resulting Blob with image/jpeg even if the browser reported a different type', async () => {
    mockFetchBlob(new Blob(['jpeg-bytes'], { type: 'application/octet-stream' }));
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    const [, value] = appendSpy.mock.calls[0] as [string, Blob];
    expect(value.type).toBe('image/jpeg');
  });

  it('does not append a plain RN-style { uri, name, type } object on web', async () => {
    mockFetchBlob(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }));
    (authorizedMultipartRequest as jest.Mock).mockResolvedValue({ id: 'photo-1' });
    const appendSpy = jest.spyOn(FormData.prototype, 'append');

    await uploadReturnPhoto('return-1', NORMALIZED);

    const [, value] = appendSpy.mock.calls[0];
    expect(value).not.toEqual(expect.objectContaining({ uri: expect.any(String) }));
  });
});

describe('listReturnPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the photos list for the given return', async () => {
    (authorizedRequestJson as jest.Mock).mockResolvedValue([]);

    await listReturnPhotos('return-1');

    expect(authorizedRequestJson).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/photos');
  });
});

describe('createReturnSignature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts exactly signerName and strokes to the signature endpoint', async () => {
    (authorizedRequestJson as jest.Mock).mockResolvedValue({ id: 'sig-1' });
    const payload: CreateReturnSignaturePayload = {
      signerName: 'John Smith',
      strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }]],
    };

    await createReturnSignature('return-1', payload);

    expect(authorizedRequestJson).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/signature', {
      method: 'POST',
      body: payload,
    });
  });

  it('never sends tenantId, driverId, signedAt, storageKey, or a return status', async () => {
    (authorizedRequestJson as jest.Mock).mockResolvedValue({ id: 'sig-1' });
    const payload: CreateReturnSignaturePayload = { signerName: 'John Smith', strokes: [[{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }]] };

    await createReturnSignature('return-1', payload);

    const [, options] = (authorizedRequestJson as jest.Mock).mock.calls[0];
    const sentKeys = Object.keys(options.body as object);
    expect(sentKeys).toEqual(['signerName', 'strokes']);
  });
});

describe('getReturnSignature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the signature metadata for the given return', async () => {
    (authorizedRequestJson as jest.Mock).mockResolvedValue({ id: 'sig-1' });

    await getReturnSignature('return-1');

    expect(authorizedRequestJson).toHaveBeenCalledWith('/api/v1/driver/returns/return-1/signature');
  });
});
