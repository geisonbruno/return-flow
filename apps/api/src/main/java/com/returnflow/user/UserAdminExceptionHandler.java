package com.returnflow.user;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * User-admin-specific {@code ProblemDetail} mapping, added on top of the
 * shared {@link com.returnflow.common.error.GlobalExceptionHandler} rather
 * than growing it, per that class's own convention.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)}: required so this advice is always
 * tried before {@code GlobalExceptionHandler}'s blanket {@code Exception.class}
 * fallback — see that class's Javadoc for why this isn't optional.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class UserAdminExceptionHandler {

	@ExceptionHandler(UserNotFoundException.class)
	ProblemDetail handleUserNotFound() {
		return problem(HttpStatus.NOT_FOUND, "User Not Found", "User not found.");
	}

	@ExceptionHandler(DuplicateEmailException.class)
	ProblemDetail handleDuplicateEmail() {
		return problem(HttpStatus.CONFLICT, "Duplicate Email", "A user with this email already exists.");
	}

	@ExceptionHandler(InvalidRouteAssignmentException.class)
	ProblemDetail handleInvalidRouteAssignment(InvalidRouteAssignmentException ex) {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Route Assignment", ex.getMessage());
	}

	@ExceptionHandler(SelfDeactivationException.class)
	ProblemDetail handleSelfDeactivation() {
		return problem(HttpStatus.BAD_REQUEST, "Self-Deactivation Not Allowed", "You cannot deactivate your own account.");
	}

	@ExceptionHandler(SelfRoleChangeException.class)
	ProblemDetail handleSelfRoleChange() {
		return problem(HttpStatus.BAD_REQUEST, "Self Role Change Not Allowed", "You cannot change your own role.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
