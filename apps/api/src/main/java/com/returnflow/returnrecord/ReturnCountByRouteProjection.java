package com.returnflow.returnrecord;

import java.util.UUID;

/**
 * One row of {@code ReturnRecordRepository.countByRouteCreatedBetween} — a
 * route with at least one return in the range, joined through
 * {@code ReturnRecord.route} (the route recorded at creation time), so a
 * route that has since been deactivated is still reported for its historical
 * returns.
 */
interface ReturnCountByRouteProjection {

	UUID getRouteId();

	String getRouteCode();

	String getRouteName();

	long getTotal();
}
