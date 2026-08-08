import { useEffect, useState } from 'react';

import { useMediaBlob } from '../returns/queries';

interface AuthenticatedImageProps {
  /** A backend-provided `contentPath` (already resolved by `useMediaBlob`/`fetchMediaBlob` — never combined with the API base twice). */
  contentPath: string;
  alt: string;
  className?: string;
}

/**
 * Renders a private, ADMIN-only media resource (a return photo or the
 * rendered customer signature) that a plain `<img src>` cannot reach — the
 * endpoint requires a bearer token, and the access token is intentionally
 * memory-only (Phase 6B1), never available to place in a URL. The bytes are
 * fetched through the same authenticated/refresh-and-retry client every
 * other request uses, then handed to the browser as a short-lived
 * `Blob`-backed object URL — never Base64, never `dangerouslySetInnerHTML`
 * (even for the SVG signature: it is always rendered as an `<img>`, so the
 * browser's image decoder handles it, not the HTML parser).
 *
 * <p>Each instance owns its own query and object-URL lifecycle, so one
 * failed image never affects any other `AuthenticatedImage` on the page —
 * callers should key a list of these by a stable per-item ID (e.g. photo
 * ID) so React remounts a fresh instance per distinct `contentPath` rather
 * than reusing one across unrelated media.
 */
export function AuthenticatedImage({ contentPath, alt, className }: AuthenticatedImageProps) {
  const blobQuery = useMediaBlob(contentPath);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blobQuery.data) {
      return;
    }
    const url = URL.createObjectURL(blobQuery.data);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobQuery.data]);

  if (blobQuery.isError) {
    return (
      <div className="authenticated-image authenticated-image--error" role="alert">
        <p>Unable to load this image.</p>
        <button type="button" onClick={() => blobQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  // Covers both "still fetching" and the one-render gap between the Blob
  // resolving and the effect above turning it into an object URL — neither
  // is an error, so both fall back to the same loading presentation.
  if (!objectUrl) {
    return (
      <div className="authenticated-image authenticated-image--loading" role="status" aria-label={`Loading ${alt}`}>
        …
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className ? `authenticated-image ${className}` : 'authenticated-image'} />;
}
