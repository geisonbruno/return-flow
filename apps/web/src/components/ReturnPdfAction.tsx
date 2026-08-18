import { useState } from 'react';

import { toSafeErrorMessage } from '../api/problemDetail';
import { openBlobInNewTab, returnPdfFilename, triggerBlobDownload } from '../returns/pdfDownload';
import { useReturnPdf } from '../returns/queries';

interface ReturnPdfActionProps {
  returnId: string;
  returnNumber: string;
}

const POPUP_BLOCKED_MESSAGE = 'Your browser blocked the new tab. Allow pop-ups for this site, or use Download PDF instead.';

/**
 * The Download PDF and Print PDF actions for a closed return. Self-contained
 * — it owns its own requests and error state rather than adding props to the
 * Return Details component chain, because nothing else on the page depends on
 * whether a PDF request is in flight.
 *
 * <p>Both actions use the same authenticated endpoint and differ only in what
 * they do with the resulting bytes: Download saves the file, Print opens it in
 * the browser's own PDF viewer. Each has its own mutation, so one being busy
 * never disables the other.
 *
 * <p>Rendered only where the authoritative status is already `CLOSED`; it
 * never re-derives that rule itself, and the backend rejects a non-closed
 * request regardless of what the UI shows.
 */
export function ReturnPdfAction({ returnId, returnNumber }: ReturnPdfActionProps) {
  const downloadMutation = useReturnPdf(returnId);
  const printMutation = useReturnPdf(returnId);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    setError(null);
    downloadMutation.mutate(undefined, {
      onSuccess: (blob) => triggerBlobDownload(blob, returnPdfFilename(returnNumber)),
      // Never reports success on failure — the button returns to its idle
      // label and the reason is shown instead.
      onError: (downloadError) => setError(toSafeErrorMessage(downloadError, 'Unable to prepare this PDF.')),
    });
  };

  const handlePrint = () => {
    setError(null);
    printMutation.mutate(undefined, {
      onSuccess: (blob) => {
        // A blocked pop-up is the one failure the fetch itself cannot report,
        // so it is surfaced here rather than left looking like a no-op.
        if (!openBlobInNewTab(blob)) {
          setError(POPUP_BLOCKED_MESSAGE);
        }
      },
      onError: (printError) => setError(toSafeErrorMessage(printError, 'Unable to prepare this PDF.')),
    });
  };

  return (
    <div className="pdf-action">
      <div className="pdf-action__buttons">
        <button type="button" onClick={handleDownload} disabled={downloadMutation.isPending}>
          {downloadMutation.isPending ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button type="button" className="secondary-button" onClick={handlePrint} disabled={printMutation.isPending}>
          {printMutation.isPending ? 'Preparing PDF…' : 'Print PDF'}
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
