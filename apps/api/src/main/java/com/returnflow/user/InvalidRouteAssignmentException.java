package com.returnflow.user;

/**
 * Covers every way a role/route combination can be invalid: an
 * {@code ADMIN} with a route, an active {@code DRIVER} without one, or a
 * {@code DRIVER} referencing a route that isn't active. One exception type
 * carrying a specific safe message keeps this from becoming three
 * near-identical classes for what is fundamentally one kind of failure.
 */
class InvalidRouteAssignmentException extends RuntimeException {

	InvalidRouteAssignmentException(String message) {
		super(message);
	}
}
