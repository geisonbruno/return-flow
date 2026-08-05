package com.returnflow.returnrecord;

import java.util.UUID;

/**
 * Raw, unparsed request parameters for the ADMIN returns list — deliberately
 * strings for {@code status}/{@code reason}/{@code createdFrom}/{@code createdTo}
 * rather than bound enum/{@code LocalDate} controller parameters, so an
 * invalid value produces this module's own {@link InvalidReturnFilterException}
 * (a safe {@code ProblemDetail}) instead of a generic Spring MVC type-mismatch
 * failure.
 */
record AdminReturnListQuery(
		int page,
		int size,
		String search,
		String status,
		String reason,
		String createdFrom,
		String createdTo,
		UUID driverId,
		UUID routeId) {
}
