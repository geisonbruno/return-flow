import { useEffect, useRef } from 'react';

import { AuthenticatedImage } from './AuthenticatedImage';

interface ImagePreviewDialogProps {
  /** The same backend-provided `contentPath` the thumbnail uses. */
  contentPath: string;
  alt: string;
  /** Accessible name and visible caption for the dialog, e.g. "Return photo 2". */
  title: string;
  onClose: () => void;
}

/**
 * A large read-only preview of one private image — deliberately not
 * `ConfirmDialog`, which exists to confirm an action and is shaped around a
 * confirm/cancel pair. This one only inspects evidence: no editing, cropping,
 * rotation, download, or zoom.
 *
 * <p>The bytes still come from {@link AuthenticatedImage}, so the preview
 * reuses the exact authenticated media path the thumbnail already uses — the
 * private `contentPath` is never placed in a public `src`, and no token ever
 * appears in a URL. Because both instances share one `useMediaBlob` cache
 * key, opening the preview while the thumbnail is mounted shows the already
 * fetched image rather than issuing a second request.
 */
export function ImagePreviewDialog({ contentPath, alt, title, onClose }: ImagePreviewDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-preview-overlay" onClick={onClose}>
      <div
        className="image-preview"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="image-preview__bar">
          <span className="image-preview__title">{title}</span>
          <button ref={closeRef} type="button" className="image-preview__close" onClick={onClose} aria-label="Close photo preview">
            ✕
          </button>
        </div>
        <AuthenticatedImage contentPath={contentPath} alt={alt} className="image-preview__image" />
      </div>
    </div>
  );
}
