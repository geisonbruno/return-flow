package com.returnflow.returnrecord;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import com.returnflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Everything here is deliberately relative (never asserting an absolute
 * starting value) so these tests are safe to run in any order, sharing the
 * cached Spring context/Testcontainers Postgres with the rest of the suite —
 * the sequence's exact current value depends on what else has already run.
 * The one test that legitimately needs a pristine sequence
 * ("first number is RF-000001") lives in
 * {@link ReturnNumberGeneratorFreshDatabaseTest} instead, with its own
 * dedicated, freshly-created context.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReturnNumberGeneratorTest {

	@Autowired
	private ReturnNumberGenerator returnNumberGenerator;

	@Test
	void formatMatchesRfFollowedByAtLeastSixDigits() {
		assertThat(returnNumberGenerator.next()).matches("RF-\\d{6,}");
	}

	@Test
	void subsequentNumbersIncrementByOne() {
		long first = numericSuffix(returnNumberGenerator.next());
		long second = numericSuffix(returnNumberGenerator.next());

		assertThat(second).isEqualTo(first + 1);
	}

	@Test
	void generatedNumbersAreUniqueAcrossManyCalls() {
		Set<String> numbers = new HashSet<>();
		for (int i = 0; i < 50; i++) {
			numbers.add(returnNumberGenerator.next());
		}

		assertThat(numbers).hasSize(50);
	}

	@Test
	void generationAdvancesWithNoReturnRecordRowsInvolvedProvingItIsNotRowCountBased() {
		// No ReturnRecord is ever persisted in this test — if the generator were
		// somehow counting rows in return_record instead of using the sequence,
		// every call here would return the same (or a non-incrementing) value.
		long first = numericSuffix(returnNumberGenerator.next());
		long second = numericSuffix(returnNumberGenerator.next());
		long third = numericSuffix(returnNumberGenerator.next());

		assertThat(second).isEqualTo(first + 1);
		assertThat(third).isEqualTo(first + 2);
	}

	@Test
	void concurrentGenerationNeverProducesDuplicates() {
		int threadCount = 20;
		ExecutorService executor = Executors.newFixedThreadPool(threadCount);
		try {
			List<CompletableFuture<String>> futures = new ArrayList<>();
			for (int i = 0; i < threadCount; i++) {
				futures.add(CompletableFuture.supplyAsync(returnNumberGenerator::next, executor));
			}
			Set<String> numbers = futures.stream().map(CompletableFuture::join).collect(Collectors.toSet());

			assertThat(numbers).hasSize(threadCount);
		} finally {
			executor.shutdown();
		}
	}

	private static long numericSuffix(String returnNumber) {
		return Long.parseLong(returnNumber.substring("RF-".length()));
	}
}
