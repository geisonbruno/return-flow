package com.returnflow.returnrecord;

/**
 * One row of {@code ReturnRecordRepository.countCreatedPerOperationalDay} —
 * an operational calendar date that actually has returns, and how many.
 *
 * <p>{@code day} is deliberately a {@code String} in {@code YYYY-MM-DD} form
 * rather than a {@code LocalDate}: this is a native query, so the value would
 * otherwise arrive as a {@code java.sql.Date} and depend on projection-level
 * type conversion to become a {@code LocalDate}. Formatting the date in SQL
 * and parsing it in the service is one unambiguous step instead.
 */
interface ReturnCountByDateProjection {

	String getDay();

	long getTotal();
}
