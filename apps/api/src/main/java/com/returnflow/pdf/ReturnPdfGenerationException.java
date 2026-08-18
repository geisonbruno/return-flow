package com.returnflow.pdf;

/**
 * Wraps a genuine rendering/IO failure inside {@link ReturnPdfGenerator} so
 * callers never have to handle {@code IOException} from a purely in-memory
 * operation. Covers the "PDF generation failure" error category named in
 * {@code apps/api/CLAUDE.md}; the message is intentionally generic, with the
 * real cause carried only in the exception chain for the logs.
 */
public class ReturnPdfGenerationException extends RuntimeException {

	public ReturnPdfGenerationException(String message, Throwable cause) {
		super(message, cause);
	}
}
