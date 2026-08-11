package com.returnflow.returnrecord;

/**
 * Covers every "wrong status for this transition" case across Start Review,
 * Release Review, Take Over Review, Close, and Cancel — one exception type
 * carrying a specific safe message, mirroring {@code user.InvalidRouteAssignmentException},
 * rather than a separate class per transition/status combination.
 */
class InvalidReturnLifecycleException extends RuntimeException {

	InvalidReturnLifecycleException(String message) {
		super(message);
	}
}
