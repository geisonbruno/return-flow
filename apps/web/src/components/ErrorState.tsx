interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/** A plain, safe error line plus Retry — never raw ProblemDetail JSON (see `api/problemDetail.ts`'s `toSafeErrorMessage`). */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
