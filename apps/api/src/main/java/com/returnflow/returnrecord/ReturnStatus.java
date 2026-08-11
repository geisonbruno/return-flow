package com.returnflow.returnrecord;

/**
 * The complete V1 lifecycle (root {@code CLAUDE.md} §9): {@code AWAITING_WAREHOUSE}
 * → {@code IN_REVIEW} → {@code CLOSED} or {@code CANCELLED}, with an ADMIN
 * able to cancel directly from {@code AWAITING_WAREHOUSE} too.
 * {@code CLOSED}/{@code CANCELLED} are terminal — {@code AdminReturnReviewService}
 * rejects every lifecycle mutation once either is reached.
 */
public enum ReturnStatus {
	AWAITING_WAREHOUSE,
	IN_REVIEW,
	CLOSED,
	CANCELLED
}
