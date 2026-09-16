package com.returnflow.auth.security;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The exact browser origins allowed to call this API cross-origin, supplied
 * by the environment as {@code APP_CORS_ALLOWED_ORIGINS} (comma-separated for
 * more than one).
 *
 * <p>Deliberately configuration, not a Spring profile. The previous CORS
 * allowance existed only under the {@code local} profile, so a deployed Web
 * app — which always runs on a different origin than the API — received no
 * CORS headers at all and every browser call failed. Making the origin list a
 * property means one implementation serves local development and a deployed
 * environment alike, and no deployed domain is ever committed to source
 * control.
 *
 * <p>Fail-closed: with no origin configured, {@code SecurityConfig} registers
 * no CORS handling whatsoever, which denies every cross-origin browser call
 * rather than permitting one. Native iOS/Android requests never travel
 * through a browser and are unaffected either way.
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

	private static final String WILDCARD = "*";

	/**
	 * The configured origins, trimmed, with blank entries dropped — empty when
	 * CORS is not configured at all.
	 *
	 * <p>{@code "*"} is rejected outright rather than passed through to
	 * {@code CorsConfiguration}. An allow-any-origin API is never an intended
	 * configuration for this product, and refusing to start is far easier to
	 * notice than a permissive deployment nobody thinks to inspect.
	 *
	 * <p>A pure function, like {@code user.BootstrapAdminProperties}, so the
	 * parsing and the wildcard rule can be unit-tested without booting a
	 * context or a database.
	 */
	public List<String> resolveAllowedOrigins() {
		if (allowedOrigins == null) {
			return List.of();
		}
		List<String> resolved = allowedOrigins.stream()
				.filter(origin -> origin != null && !origin.isBlank())
				.map(String::trim)
				.toList();
		if (resolved.contains(WILDCARD)) {
			throw new IllegalStateException(
					"app.cors.allowed-origins must list explicit origins; \"" + WILDCARD + "\" is not accepted.");
		}
		return resolved;
	}
}
