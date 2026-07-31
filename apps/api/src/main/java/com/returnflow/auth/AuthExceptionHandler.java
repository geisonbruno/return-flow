package com.returnflow.auth;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Auth-specific {@code ProblemDetail} mapping, added on top of the shared
 * {@link com.returnflow.common.error.GlobalExceptionHandler} rather than
 * growing it, per that class's own convention. Messages are deliberately
 * generic — see each exception's Javadoc for why.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)}: required so this advice is always
 * tried before {@code GlobalExceptionHandler}'s blanket {@code Exception.class}
 * fallback — see that class's Javadoc for why this isn't optional.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class AuthExceptionHandler {

	@ExceptionHandler(InvalidCredentialsException.class)
	ProblemDetail handleInvalidCredentials() {
		return problem(HttpStatus.UNAUTHORIZED, "Invalid Credentials", "Invalid email or password.");
	}

	@ExceptionHandler(InvalidRefreshTokenException.class)
	ProblemDetail handleInvalidRefreshToken() {
		return problem(HttpStatus.UNAUTHORIZED, "Invalid Refresh Token", "Invalid or expired refresh token.");
	}

	@ExceptionHandler(InactiveUserException.class)
	ProblemDetail handleInactiveUser() {
		return problem(HttpStatus.UNAUTHORIZED, "Inactive Account", "This account is no longer active.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
