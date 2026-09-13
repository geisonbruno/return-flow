/**
 * Jest environment shims. Test infrastructure only — no production code
 * depends on anything here.
 *
 * React Native ships a `URL.createObjectURL`, but it delegates to the native
 * BlobModule, which no JS test runtime provides: it throws here even though it
 * works on a device and in a browser. Standing in for it lets the
 * authenticated-media components exercise their real code path, while the
 * actual byte-to-URI conversion stays a platform concern verified on device.
 */
let objectUrlCounter = 0;

const urlApi = globalThis.URL as unknown as {
  createObjectURL?: (blob: unknown) => string;
  revokeObjectURL?: (url: string) => void;
};

if (urlApi) {
  urlApi.createObjectURL = () => `blob:returnflow-test/${(objectUrlCounter += 1)}`;
  urlApi.revokeObjectURL = () => {};
}

export {};
