package com.returnflow.returnrecord;

/**
 * Thrown when {@code reasonDetails} is missing/blank while
 * {@link ReturnReason#OTHER} is selected, too long, or supplied for any
 * reason other than {@code OTHER}.
 */
class InvalidReasonDetailsException extends RuntimeException {
}
