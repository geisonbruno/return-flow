interface LoadingStateProps {
  label?: string;
}

/** An inline loading indicator for a section of a page — never a full-page takeover (see `FullPageLoading` for that). */
export function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <p className="loading-state" role="status" aria-live="polite">
      {label}
    </p>
  );
}
