package com.returnflow.route;

/**
 * The single normalization rule (trim + uppercase) applied to a route code
 * before it is ever compared or persisted, mirroring
 * {@code user.EmailNormalizer}'s role for email addresses.
 */
public final class RouteCodeNormalizer {

	private RouteCodeNormalizer() {
	}

	public static String normalize(String code) {
		if (code == null) {
			return null;
		}
		return code.trim().toUpperCase();
	}
}
