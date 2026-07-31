package com.returnflow.route;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RouteCodeNormalizerTest {

	@Test
	void trimsWhitespaceAndUppercasesLetters() {
		assertThat(RouteCodeNormalizer.normalize("  5b  ")).isEqualTo("5B");
	}

	@Test
	void leavesAnAlreadyNormalizedCodeUnchanged() {
		assertThat(RouteCodeNormalizer.normalize("5")).isEqualTo("5");
	}

	@Test
	void differentCasingNormalizesToTheSameValue() {
		assertThat(RouteCodeNormalizer.normalize("nb5")).isEqualTo(RouteCodeNormalizer.normalize("NB5"));
	}
}
