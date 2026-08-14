import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  /** Optional extra content between the message and the action buttons — a Close confirmation summary, a Cancel reason field, etc. */
  children?: ReactNode;
}

/**
 * A focus-managed modal naming exactly what will happen, requiring explicit
 * confirmation — per `docs/WEB_UX.md` §10's "Destructive confirmation" row.
 * Used for every warehouse-review action that needs one (Release, Takeover,
 * Close, Cancel) rather than one bespoke dialog per action.
 */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel, confirmDisabled, children }: ConfirmDialogProps) {
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        {children}
        <div className="confirm-dialog__actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
