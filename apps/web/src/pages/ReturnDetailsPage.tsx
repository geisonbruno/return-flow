import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ApiError, toSafeErrorMessage } from '../api/problemDetail';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { isValidUuid } from '../returns/filters';
import { useReturnDetail } from '../returns/queries';
import { REASON_LABELS, STATUS_LABELS, formatQuantityAndUnit } from '../returns/returnOptions';
import { formatSydneyTimestamp } from '../returns/sydneyDate';
import type { AdminReturnDetail } from '../returns/types';
import { sanitizeRedirectTarget } from '../routes/safeRedirect';

const NOT_FOUND_MESSAGE = 'This return could not be found.';
const FORBIDDEN_MESSAGE = "You don't have permission to do this.";

export function ReturnDetailsPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const location = useLocation();

  // A malformed route parameter is never sent to the backend — it fails
  // safe as "not found" immediately, matching what a real nonexistent ID
  // would show anyway.
  const validId = typeof returnId === 'string' && isValidUuid(returnId);
  const detailQuery = useReturnDetail(returnId ?? '', validId);

  useEffect(() => {
    document.title = detailQuery.data ? `ReturnFlow — ${detailQuery.data.returnNumber}` : 'ReturnFlow — Return Details';
  }, [detailQuery.data]);

  // Preserves the Returns page's own path+query when navigation arrived
  // from there (see ReturnsListPage's row links); sanitized the same way
  // ProtectedRoute guards its own "return here after login" state, so this
  // can never become an open redirect.
  const backTo = sanitizeRedirectTarget((location.state as { from?: unknown } | null)?.from, '/returns');

  const notFoundFromApi = detailQuery.isError && detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
  const notFound = !validId || notFoundFromApi;
  const forbidden = detailQuery.isError && detailQuery.error instanceof ApiError && detailQuery.error.status === 403;

  return (
    <section className="return-details-page">
      <div className="page-header">
        <div className="return-details-page__heading">
          <Link to={backTo} className="return-details-page__back">
            ← Back to Returns
          </Link>
          {!notFound && !forbidden && detailQuery.data && (
            <div className="return-details-page__title">
              <h1>{detailQuery.data.returnNumber}</h1>
              <StatusBadge label={STATUS_LABELS[detailQuery.data.status]} />
            </div>
          )}
        </div>
        <button type="button" onClick={() => detailQuery.refetch()} disabled={!validId}>
          Refresh
        </button>
      </div>

      {notFound ? (
        <p>{NOT_FOUND_MESSAGE}</p>
      ) : forbidden ? (
        <p>{FORBIDDEN_MESSAGE}</p>
      ) : detailQuery.isPending ? (
        <LoadingState label="Loading return details…" />
      ) : detailQuery.isError ? (
        <ErrorState message={toSafeErrorMessage(detailQuery.error, 'Unable to load this return.')} onRetry={() => detailQuery.refetch()} />
      ) : (
        <ReturnDetailsContent detail={detailQuery.data} />
      )}
    </section>
  );
}

function ReturnDetailsContent({ detail }: { detail: AdminReturnDetail }) {
  const sortedPhotos = [...detail.photos].sort((a, b) => a.position - b.position);

  return (
    <div className="return-details-content">
      <section className="return-details-section">
        <h2>Return information</h2>
        <dl className="detail-list">
          <div>
            <dt>Customer</dt>
            <dd>{detail.customerName}</dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{detail.productName}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{formatQuantityAndUnit(detail.quantity, detail.unit)}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{REASON_LABELS[detail.reason]}</dd>
          </div>
          {detail.reasonDetails && (
            <div>
              <dt>Reason details</dt>
              <dd>{detail.reasonDetails}</dd>
            </div>
          )}
          <div>
            <dt>Observation</dt>
            <dd className="detail-list__preserve-lines">{detail.observation || 'No observation.'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatSydneyTimestamp(detail.createdAt)} (Sydney time)</dd>
          </div>
        </dl>
      </section>

      <section className="return-details-section">
        <h2>Driver and route</h2>
        <dl className="detail-list">
          <div>
            <dt>Driver</dt>
            <dd>{detail.driver.fullName}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>
              {detail.route.code} — {detail.route.name}
            </dd>
          </div>
        </dl>
      </section>

      <section className="return-details-section">
        <h2>Photos ({detail.photos.length})</h2>
        {sortedPhotos.length === 0 ? (
          <p>No photos yet.</p>
        ) : (
          <div className="photo-grid">
            {sortedPhotos.map((photo, index) => (
              <AuthenticatedImage key={photo.id} contentPath={photo.contentPath} alt={`Return photo ${index + 1}`} className="photo-grid__item" />
            ))}
          </div>
        )}
      </section>

      <section className="return-details-section">
        <h2>Customer signature</h2>
        {detail.signature ? (
          <div className="signature-block">
            <p>
              Signed by {detail.signature.signerName} on {formatSydneyTimestamp(detail.signature.signedAt)} (Sydney time)
            </p>
            <AuthenticatedImage
              contentPath={detail.signature.contentPath}
              alt={`Customer signature from ${detail.signature.signerName}`}
              className="signature-block__image"
            />
          </div>
        ) : (
          <p>Signature pending.</p>
        )}
      </section>
    </div>
  );
}
