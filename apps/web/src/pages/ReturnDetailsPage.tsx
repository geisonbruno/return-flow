import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { ApiError, toReviewConflictMessage, toSafeErrorMessage } from '../api/problemDetail';
import { AuthenticatedImage } from '../components/AuthenticatedImage';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { StatusBadge } from '../components/StatusBadge';
import { WarehouseSignaturePad, type WarehouseSignaturePadHandle } from '../components/WarehouseSignaturePad';
import { YesNoField } from '../components/YesNoField';
import { isValidUuid } from '../returns/filters';
import { useCancelReturn, useCloseReturn, useReleaseReview, useReturnDetail, useStartReview, useTakeOverReview } from '../returns/queries';
import { REASON_LABELS, STATUS_LABELS, formatQuantityAndUnit } from '../returns/returnOptions';
import { hasMeaningfulSignature, validateSignerName } from '../returns/signatureValidation';
import { formatSydneyTimestamp } from '../returns/sydneyDate';
import type { AdminReturnDetail, SignatureStroke } from '../returns/types';
import { useNavigationGuard } from '../routes/navigationGuard';
import { sanitizeRedirectTarget } from '../routes/safeRedirect';

const NOT_FOUND_MESSAGE = 'This return could not be found.';
const FORBIDDEN_MESSAGE = "You don't have permission to do this.";
const UNSAVED_REVIEW_WARNING = 'Unsaved review information will be discarded.';

interface WarehouseFormState {
  sellable: boolean | null;
  creditCustomer: boolean | null;
  chargeCustomer: boolean | null;
  chargeDriver: boolean | null;
  warehouseObservation: string;
  warehouseRepresentativeName: string;
  strokes: SignatureStroke[];
}

const EMPTY_WAREHOUSE_FORM: WarehouseFormState = {
  sellable: null,
  creditCustomer: null,
  chargeCustomer: null,
  chargeDriver: null,
  warehouseObservation: '',
  warehouseRepresentativeName: '',
  strokes: [],
};

interface CloseValidationErrors {
  sellable?: string;
  creditCustomer?: string;
  chargeCustomer?: string;
  chargeDriver?: string;
  representativeName?: string;
  signature?: string;
}

function isFormDirty(form: WarehouseFormState): boolean {
  return (
    form.sellable !== null ||
    form.creditCustomer !== null ||
    form.chargeCustomer !== null ||
    form.chargeDriver !== null ||
    form.warehouseObservation.trim() !== '' ||
    form.warehouseRepresentativeName.trim() !== '' ||
    form.strokes.length > 0
  );
}

function yesNo(value: boolean | null): string {
  return value === null ? '—' : value ? 'Yes' : 'No';
}

export function ReturnDetailsPage() {
  const { returnId } = useParams<{ returnId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setDirty: setGuardDirty, guardNavigation } = useNavigationGuard();

  // A malformed route parameter is never sent to the backend — it fails
  // safe as "not found" immediately, matching what a real nonexistent ID
  // would show anyway.
  const validId = typeof returnId === 'string' && isValidUuid(returnId);
  const detailQuery = useReturnDetail(returnId ?? '', validId);
  const detail = detailQuery.data;

  const startReviewMutation = useStartReview(returnId ?? '');
  const releaseReviewMutation = useReleaseReview(returnId ?? '');
  const takeOverReviewMutation = useTakeOverReview(returnId ?? '');
  const closeReturnMutation = useCloseReturn(returnId ?? '');
  const cancelReturnMutation = useCancelReturn(returnId ?? '');

  const [form, setForm] = useState<WarehouseFormState>(EMPTY_WAREHOUSE_FORM);
  const [closeValidation, setCloseValidation] = useState<CloseValidationErrors>({});
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [takeoverDialogOpen, setTakeoverDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const padRef = useRef<WarehouseSignaturePadHandle>(null);

  const formDirty = isFormDirty(form);

  // A new review session (a fresh Start Review or a Take Over Review) always
  // moves `reviewStartedAt` forward — resetting on it, rather than on
  // ownership alone, means neither an owner's own re-render nor a takeover
  // by someone else can ever leave a stale draft behind, and a new owner
  // never inherits a previous reviewer's browser-only, never-transmitted
  // values (there is nothing to inherit — see root CLAUDE.md §13.1/`docs/WEB_UX.md` §8).
  useEffect(() => {
    setForm(EMPTY_WAREHOUSE_FORM);
    setCloseValidation({});
    padRef.current?.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.reviewStartedAt]);

  useEffect(() => {
    if (!formDirty) {
      return;
    }
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formDirty]);

  // Keeps the shared navigation guard (AppShell's nav links, Return
  // Details' own "Back to Returns" link) in sync with this page's local
  // dirty state — the single source of truth stays the form itself; the
  // guard only ever mirrors it, never stores a copy of the values.
  useEffect(() => {
    setGuardDirty(formDirty);
  }, [formDirty, setGuardDirty]);

  // Unmount-only: leaving this page by any means (including a guarded
  // navigation the admin just confirmed) must never leave a stale "dirty"
  // flag active for whatever page mounts next.
  useEffect(() => {
    return () => setGuardDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = detail ? `ReturnFlow — ${detail.returnNumber}` : 'ReturnFlow — Return Details';
  }, [detail]);

  // Preserves the Returns page's own path+query when navigation arrived
  // from there (see ReturnsListPage's row links); sanitized the same way
  // ProtectedRoute guards its own "return here after login" state, so this
  // can never become an open redirect.
  const backTo = sanitizeRedirectTarget((location.state as { from?: unknown } | null)?.from, '/returns');

  function handleBackClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!formDirty) {
      return;
    }
    event.preventDefault();
    guardNavigation(() => navigate(backTo));
  }

  function clearFormAfterAction() {
    setForm(EMPTY_WAREHOUSE_FORM);
    padRef.current?.clear();
    setCloseValidation({});
  }

  function handleStartReview() {
    setLifecycleMessage(null);
    startReviewMutation.mutate(undefined, {
      onError: (error) => {
        setLifecycleMessage(toReviewConflictMessage(error, 'Unable to start the review.'));
        void detailQuery.refetch();
      },
    });
  }

  function handleConfirmRelease() {
    releaseReviewMutation.mutate(undefined, {
      onSuccess: () => {
        setReleaseDialogOpen(false);
        clearFormAfterAction();
        setLifecycleMessage(null);
      },
      onError: (error) => {
        setReleaseDialogOpen(false);
        setLifecycleMessage(toReviewConflictMessage(error, 'Unable to release this review.'));
        void detailQuery.refetch();
      },
    });
  }

  function handleConfirmTakeover() {
    if (!detail?.reviewer) {
      return;
    }
    takeOverReviewMutation.mutate(detail.reviewer.id, {
      onSuccess: () => {
        setTakeoverDialogOpen(false);
        setLifecycleMessage(null);
      },
      onError: (error) => {
        setTakeoverDialogOpen(false);
        setLifecycleMessage(toReviewConflictMessage(error, 'The current reviewer has changed since you last viewed this return.'));
        void detailQuery.refetch();
      },
    });
  }

  function handleCloseClick() {
    const errors: CloseValidationErrors = {};
    if (form.sellable === null) errors.sellable = 'Select Yes or No.';
    if (form.creditCustomer === null) errors.creditCustomer = 'Select Yes or No.';
    if (form.chargeCustomer === null) errors.chargeCustomer = 'Select Yes or No.';
    if (form.chargeDriver === null) errors.chargeDriver = 'Select Yes or No.';
    const nameError = validateSignerName(form.warehouseRepresentativeName);
    if (nameError) errors.representativeName = nameError;
    if (!hasMeaningfulSignature(form.strokes)) errors.signature = 'Draw the warehouse signature before closing.';
    setCloseValidation(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setCloseDialogOpen(true);
  }

  function handleConfirmClose() {
    if (form.sellable === null || form.creditCustomer === null || form.chargeCustomer === null || form.chargeDriver === null) {
      return;
    }
    closeReturnMutation.mutate(
      {
        sellable: form.sellable,
        creditCustomer: form.creditCustomer,
        chargeCustomer: form.chargeCustomer,
        chargeDriver: form.chargeDriver,
        warehouseObservation: form.warehouseObservation.trim() || undefined,
        warehouseRepresentativeName: form.warehouseRepresentativeName.trim(),
        warehouseSignatureStrokes: form.strokes,
      },
      {
        onSuccess: () => {
          setCloseDialogOpen(false);
          clearFormAfterAction();
          setLifecycleMessage(null);
        },
        onError: (error) => {
          setCloseDialogOpen(false);
          const isConflict = error instanceof ApiError && error.status === 409;
          setLifecycleMessage(toReviewConflictMessage(error, 'Unable to close this return. Please check the required fields and try again.'));
          if (isConflict) {
            void detailQuery.refetch();
          }
          // Not a conflict: keep the entered form/signature values so the
          // admin can correct and retry — per `docs/WEB_UX.md` §8.
        },
      },
    );
  }

  function handleConfirmCancel() {
    const reason = cancelReason.trim();
    if (!reason) {
      return;
    }
    cancelReturnMutation.mutate(reason, {
      onSuccess: () => {
        setCancelDialogOpen(false);
        setCancelReason('');
        clearFormAfterAction();
        setLifecycleMessage(null);
      },
      onError: (error) => {
        setLifecycleMessage(toReviewConflictMessage(error, 'Unable to cancel this return.'));
        void detailQuery.refetch();
      },
    });
  }

  const notFoundFromApi = detailQuery.isError && detailQuery.error instanceof ApiError && detailQuery.error.status === 404;
  const notFound = !validId || notFoundFromApi;
  const forbidden = detailQuery.isError && detailQuery.error instanceof ApiError && detailQuery.error.status === 403;

  return (
    <section className="return-details-page">
      <div className="page-header">
        <div className="return-details-page__heading">
          <Link to={backTo} className="return-details-page__back" onClick={handleBackClick}>
            ← Back to Returns
          </Link>
          {!notFound && !forbidden && detail && (
            <div className="return-details-page__title">
              <h1>{detail.returnNumber}</h1>
              <StatusBadge label={STATUS_LABELS[detail.status]} />
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
        detail && (
          <ReturnDetailsContent
            detail={detail}
            currentUserId={user?.userId ?? null}
            form={form}
            setForm={setForm}
            padRef={padRef}
            closeValidation={closeValidation}
            lifecycleMessage={lifecycleMessage}
            onDismissLifecycleMessage={() => setLifecycleMessage(null)}
            onStartReview={handleStartReview}
            startReviewPending={startReviewMutation.isPending}
            onOpenRelease={() => setReleaseDialogOpen(true)}
            onOpenTakeover={() => setTakeoverDialogOpen(true)}
            onCloseClick={handleCloseClick}
            closePending={closeReturnMutation.isPending}
            onOpenCancel={() => setCancelDialogOpen(true)}
          />
        )
      )}

      {releaseDialogOpen && (
        <ConfirmDialog
          title="Release this review?"
          message={formDirty ? `The return will go back to Awaiting Warehouse. ${UNSAVED_REVIEW_WARNING}` : 'The return will go back to Awaiting Warehouse.'}
          confirmLabel="Release Review"
          onConfirm={handleConfirmRelease}
          onCancel={() => setReleaseDialogOpen(false)}
          confirmDisabled={releaseReviewMutation.isPending}
        />
      )}

      {takeoverDialogOpen && detail?.reviewer && (
        <ConfirmDialog
          title="Take over this review?"
          message={`This review is currently owned by ${detail.reviewer.fullName}. Taking over reassigns it to you and starts with an empty form.`}
          confirmLabel="Take Over Review"
          onConfirm={handleConfirmTakeover}
          onCancel={() => setTakeoverDialogOpen(false)}
          confirmDisabled={takeOverReviewMutation.isPending}
        />
      )}

      {closeDialogOpen && (
        <ConfirmDialog
          title="Close this return?"
          message="This will permanently record the warehouse decision. Review the summary before confirming."
          confirmLabel="Close Return"
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseDialogOpen(false)}
          confirmDisabled={closeReturnMutation.isPending}
        >
          <ul className="confirm-dialog__summary">
            <li>Sellable: {yesNo(form.sellable)}</li>
            <li>Credit customer: {yesNo(form.creditCustomer)}</li>
            <li>Charge customer: {yesNo(form.chargeCustomer)}</li>
            <li>Charge driver: {yesNo(form.chargeDriver)}</li>
            <li>Warehouse representative: {form.warehouseRepresentativeName.trim()}</li>
          </ul>
        </ConfirmDialog>
      )}

      {cancelDialogOpen && (
        <ConfirmDialog
          title="Cancel this return?"
          message="This permanently cancels the return. Cancellation is not deletion — the record remains searchable."
          confirmLabel="Cancel Return"
          cancelLabel="Keep Return"
          onConfirm={handleConfirmCancel}
          onCancel={() => {
            setCancelDialogOpen(false);
            setCancelReason('');
          }}
          confirmDisabled={!cancelReason.trim() || cancelReturnMutation.isPending}
        >
          <div className="form-field">
            <label htmlFor="cancel-reason">Cancellation reason</label>
            <textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} />
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}

interface ReturnDetailsContentProps {
  detail: AdminReturnDetail;
  currentUserId: string | null;
  form: WarehouseFormState;
  setForm: React.Dispatch<React.SetStateAction<WarehouseFormState>>;
  padRef: React.RefObject<WarehouseSignaturePadHandle | null>;
  closeValidation: CloseValidationErrors;
  lifecycleMessage: string | null;
  onDismissLifecycleMessage: () => void;
  onStartReview: () => void;
  startReviewPending: boolean;
  onOpenRelease: () => void;
  onOpenTakeover: () => void;
  onCloseClick: () => void;
  closePending: boolean;
  onOpenCancel: () => void;
}

function ReturnDetailsContent({
  detail,
  currentUserId,
  form,
  setForm,
  padRef,
  closeValidation,
  lifecycleMessage,
  onDismissLifecycleMessage,
  onStartReview,
  startReviewPending,
  onOpenRelease,
  onOpenTakeover,
  onCloseClick,
  closePending,
  onOpenCancel,
}: ReturnDetailsContentProps) {
  const sortedPhotos = [...detail.photos].sort((a, b) => a.position - b.position);
  const isOwner = detail.status === 'IN_REVIEW' && detail.reviewer !== null && detail.reviewer.id === currentUserId;

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

      <section className="return-details-section return-details-section--review">
        <h2>Warehouse review</h2>

        {lifecycleMessage && (
          <div className="error-message" role="alert">
            <p>{lifecycleMessage}</p>
            <button type="button" onClick={onDismissLifecycleMessage}>
              Dismiss
            </button>
          </div>
        )}

        {detail.status === 'AWAITING_WAREHOUSE' && (
          <div className="review-actions">
            <p>This return is waiting for warehouse review.</p>
            <div className="review-actions__buttons">
              <button type="button" onClick={onStartReview} disabled={startReviewPending}>
                Start Review
              </button>
              <button type="button" className="secondary-button" onClick={onOpenCancel}>
                Cancel Return
              </button>
            </div>
          </div>
        )}

        {detail.status === 'IN_REVIEW' && detail.reviewer && (
          <>
            <p className="review-banner">
              {isOwner ? 'In review by you' : `In review by ${detail.reviewer.fullName}`} — started {formatSydneyTimestamp(detail.reviewStartedAt as string)}{' '}
              (Sydney time)
            </p>

            {isOwner ? (
              <>
                <WarehouseReviewForm form={form} setForm={setForm} padRef={padRef} closeValidation={closeValidation} />
                <div className="review-actions__buttons">
                  <button type="button" onClick={onCloseClick} disabled={closePending}>
                    Close Return
                  </button>
                  <button type="button" className="secondary-button" onClick={onOpenRelease}>
                    Release Review
                  </button>
                  <button type="button" className="secondary-button" onClick={onOpenCancel}>
                    Cancel Return
                  </button>
                </div>
              </>
            ) : (
              <div className="review-actions__buttons">
                <button type="button" onClick={onOpenTakeover}>
                  Take Over Review
                </button>
                <button type="button" className="secondary-button" onClick={onOpenCancel}>
                  Cancel Return
                </button>
              </div>
            )}
          </>
        )}

        {detail.status === 'CLOSED' && <ClosedWarehouseSummary detail={detail} />}
        {detail.status === 'CANCELLED' && <CancelledSummary detail={detail} />}
      </section>
    </div>
  );
}

interface WarehouseReviewFormProps {
  form: WarehouseFormState;
  setForm: React.Dispatch<React.SetStateAction<WarehouseFormState>>;
  padRef: React.RefObject<WarehouseSignaturePadHandle | null>;
  closeValidation: CloseValidationErrors;
}

function WarehouseReviewForm({ form, setForm, padRef, closeValidation }: WarehouseReviewFormProps) {
  return (
    <div className="review-form">
      <YesNoField
        name="sellable"
        label="Sellable"
        value={form.sellable}
        onChange={(value) => setForm((prev) => ({ ...prev, sellable: value }))}
      />
      {closeValidation.sellable && <p className="field-error">{closeValidation.sellable}</p>}

      <YesNoField
        name="creditCustomer"
        label="Credit customer"
        value={form.creditCustomer}
        onChange={(value) => setForm((prev) => ({ ...prev, creditCustomer: value }))}
      />
      {closeValidation.creditCustomer && <p className="field-error">{closeValidation.creditCustomer}</p>}

      <YesNoField
        name="chargeCustomer"
        label="Charge customer"
        value={form.chargeCustomer}
        onChange={(value) => setForm((prev) => ({ ...prev, chargeCustomer: value }))}
      />
      {closeValidation.chargeCustomer && <p className="field-error">{closeValidation.chargeCustomer}</p>}

      <YesNoField
        name="chargeDriver"
        label="Charge driver"
        value={form.chargeDriver}
        onChange={(value) => setForm((prev) => ({ ...prev, chargeDriver: value }))}
      />
      {closeValidation.chargeDriver && <p className="field-error">{closeValidation.chargeDriver}</p>}

      <div className="form-field">
        <label htmlFor="warehouse-observation">Warehouse observation (optional)</label>
        <textarea
          id="warehouse-observation"
          value={form.warehouseObservation}
          onChange={(event) => setForm((prev) => ({ ...prev, warehouseObservation: event.target.value }))}
          rows={3}
        />
      </div>

      <div className="form-field">
        <label htmlFor="warehouse-representative-name">Warehouse representative name</label>
        <input
          id="warehouse-representative-name"
          type="text"
          value={form.warehouseRepresentativeName}
          onChange={(event) => setForm((prev) => ({ ...prev, warehouseRepresentativeName: event.target.value }))}
        />
        {closeValidation.representativeName && <p className="field-error">{closeValidation.representativeName}</p>}
      </div>

      <div className="form-field">
        <span className="review-form__signature-label">Warehouse signature</span>
        <WarehouseSignaturePad ref={padRef} onStrokesChange={(strokes) => setForm((prev) => ({ ...prev, strokes }))} />
        <div className="review-form__pad-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              padRef.current?.undoLast();
              setForm((prev) => ({ ...prev, strokes: prev.strokes.slice(0, -1) }));
            }}
          >
            Undo
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              padRef.current?.clear();
              setForm((prev) => ({ ...prev, strokes: [] }));
            }}
          >
            Clear
          </button>
        </div>
        {closeValidation.signature && <p className="field-error">{closeValidation.signature}</p>}
      </div>
    </div>
  );
}

function ClosedWarehouseSummary({ detail }: { detail: AdminReturnDetail }) {
  return (
    <dl className="detail-list">
      {detail.reviewer && (
        <div>
          <dt>Reviewed by</dt>
          <dd>{detail.reviewer.fullName}</dd>
        </div>
      )}
      {detail.reviewStartedAt && (
        <div>
          <dt>Review started at</dt>
          <dd>{formatSydneyTimestamp(detail.reviewStartedAt)} (Sydney time)</dd>
        </div>
      )}
      <div>
        <dt>Sellable</dt>
        <dd>{yesNo(detail.sellable)}</dd>
      </div>
      <div>
        <dt>Credit customer</dt>
        <dd>{yesNo(detail.creditCustomer)}</dd>
      </div>
      <div>
        <dt>Charge customer</dt>
        <dd>{yesNo(detail.chargeCustomer)}</dd>
      </div>
      <div>
        <dt>Charge driver</dt>
        <dd>{yesNo(detail.chargeDriver)}</dd>
      </div>
      <div>
        <dt>Warehouse observation</dt>
        <dd className="detail-list__preserve-lines">{detail.warehouseObservation || 'No warehouse observation.'}</dd>
      </div>
      <div>
        <dt>Warehouse representative</dt>
        <dd>{detail.warehouseRepresentativeName}</dd>
      </div>
      {detail.warehouseSignature && (
        <div>
          <dt>Warehouse signature</dt>
          <dd>
            <AuthenticatedImage
              contentPath={detail.warehouseSignature.contentPath}
              alt={`Warehouse signature from ${detail.warehouseSignature.signerName}`}
              className="signature-block__image"
            />
          </dd>
        </div>
      )}
      {detail.closedBy && (
        <div>
          <dt>Closed by</dt>
          <dd>{detail.closedBy.fullName}</dd>
        </div>
      )}
      {detail.closedAt && (
        <div>
          <dt>Closed at</dt>
          <dd>{formatSydneyTimestamp(detail.closedAt)} (Sydney time)</dd>
        </div>
      )}
    </dl>
  );
}

function CancelledSummary({ detail }: { detail: AdminReturnDetail }) {
  return (
    <dl className="detail-list">
      <div>
        <dt>Cancellation reason</dt>
        <dd>{detail.cancellationReason}</dd>
      </div>
      {detail.cancelledBy && (
        <div>
          <dt>Cancelled by</dt>
          <dd>{detail.cancelledBy.fullName}</dd>
        </div>
      )}
      {detail.cancelledAt && (
        <div>
          <dt>Cancelled at</dt>
          <dd>{formatSydneyTimestamp(detail.cancelledAt)} (Sydney time)</dd>
        </div>
      )}
    </dl>
  );
}
