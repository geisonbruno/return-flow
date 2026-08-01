package com.returnflow.returnrecord;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issues human-readable return numbers ({@code RF-000001}, {@code RF-000002},
 * ...) backed by the {@code return_number_seq} PostgreSQL sequence (see
 * {@code V7__create_return_record_table.sql}) — never row counts, timestamps,
 * random values, or in-memory counters, all of which would be unsafe under
 * concurrent creation or after a rolled-back transaction. {@code %06d}
 * zero-pads to a minimum of six digits but never truncates, so numbers keep
 * working correctly past {@code RF-999999} by simply growing wider.
 *
 * <p>{@code @Transactional} so this is independently safe to call
 * concurrently from multiple threads (each invocation gets its own
 * transaction via Spring's proxy if the caller — such as
 * {@link ReturnRecordCreator} — doesn't already have one open, in which case
 * it just joins it).
 */
@Component
class ReturnNumberGenerator {

	private final EntityManager entityManager;

	ReturnNumberGenerator(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Transactional
	String next() {
		Number value = (Number) entityManager.createNativeQuery("SELECT nextval('return_number_seq')").getSingleResult();
		return String.format("RF-%06d", value.longValue());
	}
}
