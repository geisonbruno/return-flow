package com.returnflow.returnrecord.dto;

/**
 * The four approved dashboard cards (root {@code CLAUDE.md} §17.1,
 * {@code docs/WEB_UX.md} §5). {@code inReview} and {@code closedToday} were
 * honest zeros in Phase 6A (the domain had no {@code IN_REVIEW}/{@code CLOSED}
 * status or closed-timestamp yet) and now reflect real data as of Phase 7A —
 * {@code closedToday} uses the same Australia/Sydney operational-day
 * boundary as {@code returnsToday}.
 */
public record AdminReturnSummaryResponse(int waitingWarehouse, int inReview, int closedToday, int returnsToday) {
}
