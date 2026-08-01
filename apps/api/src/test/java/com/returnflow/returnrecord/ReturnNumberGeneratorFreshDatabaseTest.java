package com.returnflow.returnrecord;

import com.returnflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code @DirtiesContext(BEFORE_CLASS)} forces Spring to discard whatever
 * context/Testcontainers Postgres is currently cached and build a brand new
 * one before this class's tests run — the only way to guarantee
 * {@code return_number_seq} genuinely starts at 1, since the rest of the
 * suite shares one cached container (and therefore one sequence) across many
 * test classes. Kept to this single assertion deliberately, isolated from
 * {@link ReturnNumberGeneratorTest}'s order-independent tests.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class ReturnNumberGeneratorFreshDatabaseTest {

	@Autowired
	private ReturnNumberGenerator returnNumberGenerator;

	@Test
	void firstGeneratedNumberInAFreshDatabaseIsRf000001() {
		assertThat(returnNumberGenerator.next()).isEqualTo("RF-000001");
	}
}
