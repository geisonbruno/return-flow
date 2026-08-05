package com.returnflow.returnrecord;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pure unit tests — no Spring context needed to prove the business-day math is correct, including real DST transitions. */
class OperationalDayServiceTest {

	private static final ZoneId SYDNEY = ZoneId.of("Australia/Sydney");

	@Test
	void startOfDayMatchesLocalMidnightInTheConfiguredZone() {
		OperationalDayService service = serviceFixedAt("2026-08-05T03:00:00Z");
		LocalDate date = LocalDate.of(2026, 8, 5);

		Instant expected = date.atStartOfDay(SYDNEY).toInstant();

		assertThat(service.startOfDay(date)).isEqualTo(expected);
	}

	@Test
	void todayReflectsTheBusinessZoneNotUtc() {
		// 2026-08-05T14:30:00Z is already 2026-08-06 in Sydney (UTC+10 in August).
		OperationalDayService service = serviceFixedAt("2026-08-05T14:30:00Z");

		assertThat(service.today()).isEqualTo(LocalDate.of(2026, 8, 6));
	}

	@Test
	void startAndEndOfTodaySpanExactly24HoursOnAnOrdinaryDay() {
		OperationalDayService service = serviceFixedAt("2026-08-05T03:00:00Z");

		Duration span = Duration.between(service.startOfToday(), service.endOfToday());

		assertThat(span).isEqualTo(Duration.ofHours(24));
	}

	@Test
	void aDayLosesAnHourAtTheSydneyDaylightSavingForwardTransition() {
		// 2026-10-04 is the first Sunday of October 2026 — Sydney clocks spring forward.
		OperationalDayService service = serviceFixedAt("2026-10-04T00:00:00Z");

		Instant start = service.startOfDay(LocalDate.of(2026, 10, 4));
		Instant end = service.startOfDay(LocalDate.of(2026, 10, 5));

		assertThat(Duration.between(start, end)).isEqualTo(Duration.ofHours(23));
	}

	@Test
	void aDayGainsAnHourAtTheSydneyDaylightSavingBackTransition() {
		// 2026-04-05 is the first Sunday of April 2026 — Sydney clocks fall back.
		OperationalDayService service = serviceFixedAt("2026-04-05T00:00:00Z");

		Instant start = service.startOfDay(LocalDate.of(2026, 4, 5));
		Instant end = service.startOfDay(LocalDate.of(2026, 4, 6));

		assertThat(Duration.between(start, end)).isEqualTo(Duration.ofHours(25));
	}

	@Test
	void recordsRightBeforeAndAfterTheBoundaryLandOnDifferentDays() {
		OperationalDayService service = serviceFixedAt("2026-08-05T03:00:00Z");
		Instant boundary = service.startOfDay(LocalDate.of(2026, 8, 5));

		Instant justBefore = boundary.minusSeconds(1);
		Instant justAfter = boundary;

		assertThat(ZonedDateTime.ofInstant(justBefore, SYDNEY).toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 4));
		assertThat(ZonedDateTime.ofInstant(justAfter, SYDNEY).toLocalDate()).isEqualTo(LocalDate.of(2026, 8, 5));
	}

	@Test
	void invalidConfiguredZoneFailsFastAtConstruction() {
		assertThatThrownBy(() -> new OperationalDayService("Not/AZone", Clock.systemUTC()))
				.isInstanceOf(IllegalStateException.class);
	}

	private static OperationalDayService serviceFixedAt(String instant) {
		return new OperationalDayService("Australia/Sydney", Clock.fixed(Instant.parse(instant), ZoneId.of("UTC")));
	}
}
