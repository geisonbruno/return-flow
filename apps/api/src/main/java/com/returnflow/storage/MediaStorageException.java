package com.returnflow.storage;

/**
 * Unchecked wrapper for storage I/O failures. Never let a message here reach
 * a client response — it may include filesystem details; the caller must map
 * this to a safe generic {@code ProblemDetail}.
 */
public class MediaStorageException extends RuntimeException {

	public MediaStorageException(String message) {
		super(message);
	}

	public MediaStorageException(String message, Throwable cause) {
		super(message, cause);
	}
}
