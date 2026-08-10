package com.returnflow.returnrecord;

/**
 * Thrown when Start Review loses a race — another ADMIN already claimed the
 * return by the time this request acquired the row lock. Exactly one
 * concurrent Start Review attempt ever succeeds; every other one lands here.
 */
class ReviewAlreadyClaimedException extends RuntimeException {

	private final String currentReviewerName;

	ReviewAlreadyClaimedException(String currentReviewerName) {
		this.currentReviewerName = currentReviewerName;
	}

	String getCurrentReviewerName() {
		return currentReviewerName;
	}
}
