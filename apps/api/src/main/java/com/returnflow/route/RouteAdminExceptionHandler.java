package com.returnflow.route;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Route-admin-specific {@code ProblemDetail} mapping, added on top of the
 * shared {@link com.returnflow.common.error.GlobalExceptionHandler} rather
 * than growing it, per that class's own convention.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)}: required so this advice is always
 * tried before {@code GlobalExceptionHandler}'s blanket {@code Exception.class}
 * fallback — see that class's Javadoc for why this isn't optional.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class RouteAdminExceptionHandler {

	@ExceptionHandler(RouteNotFoundException.class)
	ProblemDetail handleRouteNotFound() {
		return problem(HttpStatus.NOT_FOUND, "Route Not Found", "Route not found.");
	}

	@ExceptionHandler(DuplicateRouteCodeException.class)
	ProblemDetail handleDuplicateRouteCode() {
		return problem(HttpStatus.CONFLICT, "Duplicate Route Code", "A route with this code already exists.");
	}

	@ExceptionHandler(RouteInUseException.class)
	ProblemDetail handleRouteInUse() {
		return problem(HttpStatus.CONFLICT, "Route In Use",
				"This route is assigned to at least one active driver and cannot be deactivated.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
