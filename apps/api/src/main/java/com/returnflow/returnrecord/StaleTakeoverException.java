package com.returnflow.returnrecord;

/**
 * Thrown when a Take Over Review request's {@code expectedCurrentReviewerId}
 * no longer matches the return's actual current reviewer — the client
 * observed the return before some other change (a release, a prior
 * takeover) already moved review ownership elsewhere. Rejecting rather than
 * blindly overwriting is what makes takeover safe under concurrency; the
 * caller is expected to refetch and decide again.
 */
class StaleTakeoverException extends RuntimeException {

	private final String currentReviewerName;

	StaleTakeoverException(String currentReviewerName) {
		this.currentReviewerName = currentReviewerName;
	}

	String getCurrentReviewerName() {
		return currentReviewerName;
	}
}
