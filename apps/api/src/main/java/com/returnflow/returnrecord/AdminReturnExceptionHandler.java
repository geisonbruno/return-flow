package com.returnflow.returnrecord;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * ADMIN-return-specific {@code ProblemDetail} mapping, added on top of the
 * shared {@link com.returnflow.common.error.GlobalExceptionHandler} rather
 * than growing it, per that class's own convention. {@link ReturnRecordNotFoundException},
 * {@link ReturnPhotoNotFoundException}, and {@link ReturnSignatureNotFoundException}
 * need no new mapping here — {@link DriverReturnExceptionHandler} is a bare
 * (unscoped) {@code @RestControllerAdvice}, so it already applies to every
 * controller in the application, including the new ADMIN ones.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)}: required so this advice is always
 * tried before {@code GlobalExceptionHandler}'s blanket {@code Exception.class}
 * fallback — see that class's Javadoc for why this isn't optional.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class AdminReturnExceptionHandler {

	@ExceptionHandler(InvalidPageRequestException.class)
	ProblemDetail handleInvalidPageRequest() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Page Request", "Page must be zero or greater, and size must be between 1 and 100.");
	}

	@ExceptionHandler(InvalidReturnLifecycleException.class)
	ProblemDetail handleInvalidReturnLifecycle(InvalidReturnLifecycleException ex) {
		return problem(HttpStatus.CONFLICT, "Invalid Return State", ex.getMessage());
	}

	@ExceptionHandler(ReviewAlreadyClaimedException.class)
	ProblemDetail handleReviewAlreadyClaimed(ReviewAlreadyClaimedException ex) {
		return reviewerConflict(HttpStatus.CONFLICT, "Return Already In Review",
				"Another admin already started reviewing this return.", ex.getCurrentReviewerName());
	}

	@ExceptionHandler(ReviewOwnershipConflictException.class)
	ProblemDetail handleReviewOwnershipConflict(ReviewOwnershipConflictException ex) {
		return reviewerConflict(HttpStatus.CONFLICT, "Review Ownership Conflict",
				"Only the current reviewer can perform this action.", ex.getCurrentReviewerName());
	}

	@ExceptionHandler(StaleTakeoverException.class)
	ProblemDetail handleStaleTakeover(StaleTakeoverException ex) {
		return reviewerConflict(HttpStatus.CONFLICT, "Stale Takeover",
				"The current reviewer has changed since this was last observed.", ex.getCurrentReviewerName());
	}

	private static ProblemDetail reviewerConflict(HttpStatus status, String title, String detail, String currentReviewerName) {
		ProblemDetail problem = problem(status, title, detail);
		if (currentReviewerName != null) {
			problem.setProperty("currentReviewerName", currentReviewerName);
		}
		return problem;
	}

	@ExceptionHandler(InvalidReturnFilterException.class)
	ProblemDetail handleInvalidReturnFilter() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Filter",
				"One or more filters are invalid: status/reason must be a recognized value, dates must be ISO (YYYY-MM-DD), and \"from\" must not be after \"to\".");
	}

	/** Backstop for a malformed {@code driverId}/{@code routeId} (not a UUID) or non-numeric {@code page}/{@code size}. */
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	ProblemDetail handleTypeMismatch() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Filter", "One or more request parameters are malformed.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
