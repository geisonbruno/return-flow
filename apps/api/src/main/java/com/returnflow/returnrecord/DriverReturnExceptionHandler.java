package com.returnflow.returnrecord;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}
}
