package com.returnflow.returnrecord.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * The approved Dashboard analytics payload — the three charts (Returns Over
 * Time, Reasons Distribution, Top Routes by Returns) that all share one
 * selected operational date range (see {@code docs/WEB_UX.md} §5).
 *
 * <p>Deliberately separate from {@link AdminReturnSummaryResponse}: the four
 * summary cards describe current/today operational state and must never be
 * affected by this range, so the two contracts stay independent rather than
 * one endpoint serving both.
 *
 * <p>{@code from}/{@code to} are echoed back as the inclusive Sydney
 * operational calendar dates the counts were actually computed for, so the
 * client never has to re-derive what it asked for.
 *
 * <p>No display concern is encoded here — no percentages, chart totals,
 * colors, or human-readable labels. The Web already owns reason labels and
 * can sum the counts itself.
 */
public record AdminReturnAnalyticsResponse(
		LocalDate from,
		LocalDate to,
		List<ReturnsOverTimePointResponse> returnsOverTime,
		List<ReasonDistributionResponse> reasonsDistribution,
		List<TopRouteResponse> topRoutes) {
}
