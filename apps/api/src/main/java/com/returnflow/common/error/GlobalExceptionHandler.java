package com.returnflow.common.error;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Foundation-level error handling shared by every feature module: consistent
 * {@link ProblemDetail} JSON for validation failures and a safe fallback for
 * anything unexpected. Feature modules add their own business exceptions and
 * {@code @ExceptionHandler} methods on top of this rather than growing it.
 *
 * <p>{@code @Order(LOWEST_PRECEDENCE)} documents intent (this is always the
 * last resort) but is not by itself sufficient: {@code LOWEST_PRECEDENCE} is
 * {@code Integer.MAX_VALUE}, the same value an *unordered* advice bean
 * already defaults to, so it does not out-rank one. The actual guarantee
 * comes from every feature-specific advice
 * ({@code auth.AuthExceptionHandler}, {@code route.RouteAdminExceptionHandler},
 * {@code user.UserAdminExceptionHandler}, and any future one) declaring
 * {@code @Order(HIGHEST_PRECEDENCE)} — Spring picks the first
 * {@code @ControllerAdvice} bean, in order, with *any* applicable handler
 * for the thrown exception's type; it does not compare specificity across
 * advice beans. Without explicit ordering on both ends, this class's blanket
 * {@code Exception.class} fallback can silently shadow a more specific
 * handler whenever its advice bean happens to sort first (confirmed against
 * a real failing {@code mvnw test} run in Phase 2C, before this ordering was
 * added: every {@code RouteAdminExceptionHandler}/{@code UserAdminExceptionHandler}
 * response was silently downgraded from its intended 400/404/409 to 500).
 */
@RestControllerAdvice
@Order(Ordered.LOWEST_PRECEDENCE)
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(
			MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.BAD_REQUEST, "Validation failed for one or more fields.");
		problem.setTitle("Validation Error");
		List<String> errors = ex.getBindingResult().getFieldErrors().stream()
				.map(fieldError -> fieldError.getField() + ": " + fieldError.getDefaultMessage())
				.toList();
		problem.setProperty("errors", errors);
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ProblemDetail> handleUnexpected(Exception ex, WebRequest request) {
		logger.error("Unhandled exception", ex);
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
		problem.setTitle("Internal Server Error");
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
	}
}
