package com.returnflow.user;

import java.util.Optional;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the controlled first-admin bootstrap ({@code
 * BOOTSTRAP_ADMIN_EMAIL}/{@code BOOTSTRAP_ADMIN_PASSWORD}/{@code
 * BOOTSTRAP_ADMIN_NAME}). {@link #resolveIfEnabled()} is a pure function —
 * deliberately independent of any repository or Spring context — so the
 * disabled/partial/complete decision can be unit-tested without booting a
 * database.
 */
@ConfigurationProperties(prefix = "app.bootstrap.admin")
public record BootstrapAdminProperties(String email, String password, String name) {

	public Optional<BootstrapAdminProperties> resolveIfEnabled() {
		boolean anyProvided = isNotBlank(email) || isNotBlank(password) || isNotBlank(name);
		if (!anyProvided) {
			return Optional.empty();
		}
		if (isBlank(email) || isBlank(password) || isBlank(name)) {
			throw new IllegalStateException(
					"Incomplete bootstrap admin configuration: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, "
							+ "and BOOTSTRAP_ADMIN_NAME must all be set together, or all left unset to disable bootstrap.");
		}
		return Optional.of(this);
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	private static boolean isNotBlank(String value) {
		return !isBlank(value);
	}
}
