package com.returnflow.auth.security;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CorsPropertiesTest {

	@Test
	void noConfiguredOriginsResolvesEmptySoCorsIsNeverRegistered() {
		assertThat(new CorsProperties(null).resolveAllowedOrigins()).isEmpty();
		assertThat(new CorsProperties(List.of()).resolveAllowedOrigins()).isEmpty();
	}

	@Test
	void anUnsetEnvironmentVariableBindsAsBlankAndStillResolvesEmpty() {
		// `app.cors.allowed-origins=${APP_CORS_ALLOWED_ORIGINS:}` binds to a
		// single blank entry rather than an absent list, which must mean
		// "not configured" — not an origin literally named "".
		assertThat(new CorsProperties(List.of("")).resolveAllowedOrigins()).isEmpty();
		assertThat(new CorsProperties(List.of("   ")).resolveAllowedOrigins()).isEmpty();
	}

	@Test
	void aSingleConfiguredOriginIsResolved() {
		var properties = new CorsProperties(List.of("https://returnflow.example"));

		assertThat(properties.resolveAllowedOrigins()).containsExactly("https://returnflow.example");
	}

	@Test
	void multipleOriginsAreSupported() {
		var properties = new CorsProperties(List.of("https://returnflow.example", "https://admin.returnflow.example"));

		assertThat(properties.resolveAllowedOrigins())
				.containsExactly("https://returnflow.example", "https://admin.returnflow.example");
	}

	@Test
	void surroundingWhitespaceAndBlankEntriesAreIgnored() {
		// A comma-separated environment variable is easy to write with stray
		// spaces or a trailing comma; neither should become a bogus origin.
		var properties = new CorsProperties(Arrays.asList("  https://returnflow.example  ", "", "  "));

		assertThat(properties.resolveAllowedOrigins()).containsExactly("https://returnflow.example");
	}

	@Test
	void aWildcardOriginIsRejectedRatherThanQuietlyAllowingEveryOrigin() {
		var properties = new CorsProperties(List.of("*"));

		assertThatThrownBy(properties::resolveAllowedOrigins)
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("explicit origins");
	}

	@Test
	void aWildcardHiddenAmongValidOriginsIsRejectedToo() {
		var properties = new CorsProperties(List.of("https://returnflow.example", "*"));

		assertThatThrownBy(properties::resolveAllowedOrigins).isInstanceOf(IllegalStateException.class);
	}
}
