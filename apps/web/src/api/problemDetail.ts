/** The backend's RFC 7807 error shape (see `common.error.GlobalExceptionHandler`). */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: string[];
}

async function parseProblemDetail(response: Response): Promise<ProblemDetail | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) {
    return null;
  }
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      return body as ProblemDetail;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Thrown by the API client for both network failures and non-2xx HTTP
 * responses. `problem`/`status` are only present for an HTTP failure — a
 * network failure (no connection, DNS, timeout) never reaches the server at
 * all, so there is nothing to parse.
 */
export class ApiError extends Error {
  readonly kind: 'network' | 'http';
  readonly status?: number;
  readonly problem?: ProblemDetail;

  private constructor(kind: 'network' | 'http', message: string, status?: number, problem?: ProblemDetail) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.problem = problem;
  }

  static network(): ApiError {
    return new ApiError('network', 'Unable to connect to the server.', undefined, undefined);
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const problem = await parseProblemDetail(response);
    return new ApiError('http', problem?.detail ?? `Request failed with status ${response.status}.`, response.status, problem ?? undefined);
  }
}

/**
 * Turns any error this app might throw into a message safe to show an
 * ADMIN — never a stack trace, exception class name, database detail, or
 * raw token. `fallback` is used whenever the error carries no safe,
 * specific detail worth surfacing.
 */
export function toSafeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return error.message;
    }
    if (error.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (error.problem?.errors && error.problem.errors.length > 0) {
      return error.problem.errors.join(' ');
    }
    if (error.problem?.detail) {
      return error.problem.detail;
    }
    return fallback;
  }
  return fallback;
}
