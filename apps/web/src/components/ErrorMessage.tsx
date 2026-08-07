interface ErrorMessageProps {
  message: string;
}

/** A plain, user-facing error line — never a stack trace, ProblemDetail JSON, or token; see `api/problemDetail.ts`. */
export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <p className="error-message" role="alert">
      {message}
    </p>
  );
}
