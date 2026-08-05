package com.returnflow.returnrecord.dto;

/**
 * The four approved dashboard cards (root {@code CLAUDE.md} §17.1,
 * {@code docs/WEB_UX.md} §5). {@code inReview} and {@code closedToday} are
 * always {@code 0} in Phase 6A: the domain has no {@code IN_REVIEW}/{@code CLOSED}
 * {@code ReturnStatus} value and no closed-timestamp yet — both are Phase 7A
 * work. This is an honest zero (nothing can be in review or closed yet),
 * not a placeholder computed from an invented status or migration; see
 * {@code PROGRESS.md} Known issues.
 */
public record AdminReturnSummaryResponse(int waitingWarehouse, int inReview, int closedToday, int returnsToday) {
}
