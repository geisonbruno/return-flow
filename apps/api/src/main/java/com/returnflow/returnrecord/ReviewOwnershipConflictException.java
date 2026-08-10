package com.returnflow.returnrecord;

/**
 * Thrown when an ADMIN who is not the current review owner attempts an
 * owner-only action (Release Review, Close) — {@code docs/WEB_UX.md} §10's
 * "Review-ownership conflict: Show current reviewer's name, never allow a
 * silent overwrite." Same-tenant ADMINs can already see each other's names
 * via {@code GET /api/v1/admin/users}, so naming the current reviewer here
 * reveals nothing new.
 */
class ReviewOwnershipConflictException extends RuntimeException {

	private final String currentReviewerName;

	ReviewOwnershipConflictException(String currentReviewerName) {
		this.currentReviewerName = currentReviewerName;
	}

	String getCurrentReviewerName() {
		return currentReviewerName;
	}
}
