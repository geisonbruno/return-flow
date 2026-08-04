package com.returnflow.returnrecord;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * Driver-return-specific {@code ProblemDetail} mapping, added on top of the
 * shared {@link com.returnflow.common.error.GlobalExceptionHandler} rather
 * than growing it, per that class's own convention.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)}: required so this advice is always
 * tried before {@code GlobalExceptionHandler}'s blanket {@code Exception.class}
 * fallback — see that class's Javadoc for why this isn't optional.
 *
 * <p>Every handler here maps to 400 except {@link ReturnRecordNotFoundException}
 * (404). The driver/route operational-state exceptions ({@code DriverRequiredException},
 * {@code InactiveDriverException}, {@code DriverWithoutRouteException},
 * {@code InactiveRouteException}, {@code DriverTenantMismatchException},
 * {@code RouteTenantMismatchException}) are unreachable through the actual
 * driver endpoints today — the authenticated driver's own tenant and route
 * are always internally consistent by construction — but remain mapped here
 * for {@link ReturnRecordCreator}'s defense-in-depth against any future
 * caller.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class DriverReturnExceptionHandler {

	@ExceptionHandler(ReturnRecordNotFoundException.class)
	ProblemDetail handleReturnNotFound() {
		return problem(HttpStatus.NOT_FOUND, "Return Not Found", "Return not found.");
	}

	@ExceptionHandler(InvalidReasonException.class)
	ProblemDetail handleInvalidReason() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Reason", "A return reason is required.");
	}

	@ExceptionHandler(InvalidReasonDetailsException.class)
	ProblemDetail handleInvalidReasonDetails() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Reason Details",
				"Reason details are required when the reason is OTHER, and must be omitted otherwise.");
	}

	@ExceptionHandler(InvalidQuantityException.class)
	ProblemDetail handleInvalidQuantity() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Quantity", "Quantity is required and must be a positive integer.");
	}

	@ExceptionHandler(InvalidUnitException.class)
	ProblemDetail handleInvalidUnit() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Unit", "A unit is required.");
	}

	@ExceptionHandler(InvalidCustomerNameException.class)
	ProblemDetail handleInvalidCustomerName() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Customer Name", "Customer name is required.");
	}

	@ExceptionHandler(InvalidProductNameException.class)
	ProblemDetail handleInvalidProductName() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Product Name", "Product name is required.");
	}

	@ExceptionHandler(InvalidObservationException.class)
	ProblemDetail handleInvalidObservation() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Observation", "Observation is required.");
	}

	@ExceptionHandler(DriverRequiredException.class)
	ProblemDetail handleDriverRequired() {
		return problem(HttpStatus.BAD_REQUEST, "Driver Required", "Only a driver can create a return.");
	}

	@ExceptionHandler(InactiveDriverException.class)
	ProblemDetail handleInactiveDriver() {
		return problem(HttpStatus.BAD_REQUEST, "Inactive Driver", "The driver account is inactive.");
	}

	@ExceptionHandler(DriverWithoutRouteException.class)
	ProblemDetail handleDriverWithoutRoute() {
		return problem(HttpStatus.BAD_REQUEST, "Driver Without Route", "The driver has no assigned route.");
	}

	@ExceptionHandler(InactiveRouteException.class)
	ProblemDetail handleInactiveRoute() {
		return problem(HttpStatus.BAD_REQUEST, "Inactive Route", "The driver's assigned route is inactive.");
	}

	@ExceptionHandler(DriverTenantMismatchException.class)
	ProblemDetail handleDriverTenantMismatch() {
		return problem(HttpStatus.BAD_REQUEST, "Driver Tenant Mismatch", "The driver does not belong to this tenant.");
	}

	@ExceptionHandler(RouteTenantMismatchException.class)
	ProblemDetail handleRouteTenantMismatch() {
		return problem(HttpStatus.BAD_REQUEST, "Route Tenant Mismatch", "The driver's route does not belong to this tenant.");
	}

	@ExceptionHandler(ReturnPhotoNotFoundException.class)
	ProblemDetail handlePhotoNotFound() {
		return problem(HttpStatus.NOT_FOUND, "Photo Not Found", "Photo not found.");
	}

	@ExceptionHandler(InvalidPhotoFileException.class)
	ProblemDetail handleInvalidPhotoFile() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Photo File",
				"The uploaded file must be a non-empty JPEG image of 5 MB or less.");
	}

	@ExceptionHandler(PhotoLimitExceededException.class)
	ProblemDetail handlePhotoLimitExceeded() {
		return problem(HttpStatus.CONFLICT, "Photo Limit Exceeded", "A return can have at most five photos.");
	}

	/** Missing "file" multipart part entirely (as opposed to an empty file, which reaches {@link InvalidPhotoFileException}). */
	@ExceptionHandler(MissingServletRequestPartException.class)
	ProblemDetail handleMissingPart() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Photo File", "A file is required.");
	}

	/**
	 * Rejected by {@code spring.servlet.multipart.max-file-size} before this
	 * module's own {@code ReturnPhotoService} size check ever runs — a 400,
	 * not a 413, so the client sees one consistent status for "too large"
	 * regardless of which layer (container-level multipart limit, or this
	 * module's own re-check) actually caught it.
	 */
	@ExceptionHandler(MaxUploadSizeExceededException.class)
	ProblemDetail handleUploadTooLarge() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Photo File", "The uploaded file must be 5 MB or less.");
	}

	/** Fallback for any other malformed multipart request; more specific multipart exceptions above take precedence. */
	@ExceptionHandler(MultipartException.class)
	ProblemDetail handleMalformedMultipart() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Photo File", "The upload request was malformed.");
	}

	@ExceptionHandler(InvalidSignerNameException.class)
	ProblemDetail handleInvalidSignerName() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Signer Name", "Signer name is required and must be 100 characters or fewer.");
	}

	@ExceptionHandler(InvalidSignatureStrokesException.class)
	ProblemDetail handleInvalidSignatureStrokes() {
		return problem(HttpStatus.BAD_REQUEST, "Invalid Signature", "The signature drawing is missing or invalid.");
	}

	@ExceptionHandler(SignatureAlreadyExistsException.class)
	ProblemDetail handleSignatureAlreadyExists() {
		return problem(HttpStatus.CONFLICT, "Signature Already Exists", "This return already has a customer signature.");
	}

	@ExceptionHandler(ReturnSignatureNotFoundException.class)
	ProblemDetail handleSignatureNotFound() {
		return problem(HttpStatus.NOT_FOUND, "Signature Not Found", "Signature not found.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
