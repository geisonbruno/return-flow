package com.returnflow.returnrecord;

import java.util.UUID;

/**
 * Raw, unparsed request parameters for the ADMIN returns list — deliberately
 * strings for {@code status}/{@code reason}/{@code createdFrom}/{@code createdTo}/
 * {@code closedFrom}/{@code closedTo} rather than bound enum/{@code LocalDate}
 * controller parameters, so an invalid value produces this module's own
 * {@link InvalidReturnFilterException} (a safe {@code ProblemDetail}) instead
 * of a generic Spring MVC type-mismatch failure. {@code closedFrom}/{@code closedTo}
 * (Phase 7B) filter on {@code closed_at}, independently of {@code createdFrom}/
 * {@code createdTo} — a return created on one day and closed on another must
 * be reachable by whichever date range actually matches, exactly mirroring
 * the semantics of the dashboard's own {@code closedToday} count.
 */
record AdminReturnListQuery(
		int page,
		int size,
		String search,
		String status,
		String reason,
		String createdFrom,
		String createdTo,
		String closedFrom,
		String closedTo,
		UUID driverId,
		UUID routeId) {
}
