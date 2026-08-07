interface FullPageLoadingProps {
  label?: string;
}

export function FullPageLoading({ label = 'Loading…' }: FullPageLoadingProps) {
  return (
    <div className="full-page-loading" role="status" aria-live="polite">
      <span className="full-page-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
