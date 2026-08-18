/**
 * Hands an already-fetched authenticated `Blob` to the browser as a file
 * download.
 *
 * <p>The bytes arrive through the normal bearer-token API client, so the only
 * thing left to do here is present them. A short-lived object URL is used
 * rather than a direct link to the endpoint: a plain `<a href>` or
 * `window.open` cannot carry the memory-only access token, and putting a
 * token in a URL would leak it into history, logs, and the Referer header.
 *
 * <p>The URL is revoked in a `finally`, so it is released even if the click
 * throws — the blob is already in memory, and the browser has taken its own
 * reference by the time `click()` returns.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    // Appending is required for the click to be honored in Firefox.
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * How long a print tab's object URL is kept alive before it is released.
 *
 * <p>Unlike the download path, this URL cannot be revoked immediately: the
 * new tab has not finished loading it when `window.open` returns, and
 * revoking first leaves the tab showing a failed document. There is also no
 * reliable cross-document signal to revoke on — a native PDF viewer does not
 * give the opener a usable `load` event — so a bounded timer is the smallest
 * dependable cleanup available.
 *
 * <p>The trade-off is explicit: the blob stays in memory for at most this
 * long after the tab opens (the tab keeps its own copy once loaded, so
 * printing still works afterwards). It is never a permanent object URL.
 */
const PRINT_OBJECT_URL_TTL_MS = 60_000;

/**
 * Opens an already-fetched authenticated PDF `Blob` in a new browser tab so
 * the browser's own PDF viewer can print it.
 *
 * <p>Deliberately no custom print UI, no embedded viewer, and no iframe: a
 * normal tab is sufficient. `window.print()` is deliberately not called
 * either — for a PDF rendered by a native viewer it fires before the document
 * is ready often enough to be unreliable, and the viewer already offers Print.
 *
 * <p>Returns `false` when the browser blocked the new tab, so the caller can
 * say so instead of silently appearing to do nothing.
 */
export function openBlobInNewTab(blob: Blob): boolean {
  const objectUrl = URL.createObjectURL(blob);
  const printWindow = window.open(objectUrl, '_blank');
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl);
    return false;
  }
  try {
    // The new tab has no need to reach back into this one.
    printWindow.opener = null;
  } catch {
    // Some browsers make `opener` read-only; not being able to clear it must
    // not fail the print itself.
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), PRINT_OBJECT_URL_TTL_MS);
  return true;
}

/**
 * Mirrors the backend's own `Content-Disposition` filename, derived from the
 * authoritative return number rather than parsed back out of the header —
 * `authorizedRequestBlob` intentionally exposes only the body, and the return
 * number is already on the authoritative detail response.
 *
 * <p>Built from a whitelist for the same reason the backend does it: a
 * download filename should never be able to carry path separators or other
 * characters with meaning to the filesystem.
 */
export function returnPdfFilename(returnNumber: string): string {
  const safe = returnNumber.replace(/[^A-Za-z0-9\-_]/g, '-');
  return `ReturnFlow-${safe}.pdf`;
}
