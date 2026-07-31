package com.returnflow.user;

/**
 * The single normalization rule ({@code trim} + lowercase) used everywhere an
 * email is looked up or persisted, so login and bootstrap can never diverge
 * on what counts as "the same" address.
 */
public final class EmailNormalizer {

	private EmailNormalizer() {
	}

	public static String normalize(String email) {
		if (email == null) {
			return null;
		}
		return email.trim().toLowerCase();
	}
}
