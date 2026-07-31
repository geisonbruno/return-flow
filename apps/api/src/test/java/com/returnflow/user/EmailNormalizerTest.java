package com.returnflow.user;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EmailNormalizerTest {

	@Test
	void lowercasesAndTrims() {
		assertThat(EmailNormalizer.normalize("  Driver@ReturnFlow.com  ")).isEqualTo("driver@returnflow.com");
	}

	@Test
	void differentCasingNormalizesToTheSameValue() {
		String first = EmailNormalizer.normalize("Admin@Warehouse.example");
		String second = EmailNormalizer.normalize("admin@warehouse.example");

		assertThat(first).isEqualTo(second);
	}
}
