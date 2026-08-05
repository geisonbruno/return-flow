package com.returnflow.returnrecord;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Computes the ADMIN "operational day" boundary for the dashboard summary
 * and returns-list date filters — local midnight to the next local midnight
 * in the configured business timezone, converted to an {@link Instant} for
 * database queries. The browser's own timezone is never authoritative (see
 * {@code docs/WEB_UX.md} §5's Resolved MVP decisions): every ADMIN in the
 * tenant sees identical "Today" counts regardless of where they're browsing
 * from. Tenant-specific timezone configuration is deliberately deferred —
 * one tenant-wide zone is enough for the initial single-tenant Warehouse
 * pilot.
 *
 * <p>Daylight-saving transitions are handled correctly by construction:
 * {@link LocalDate#atStartOfDay(ZoneId)} resolves against the zone's real
 * {@code ZoneRules}, so a 23- or 25-hour day at a DST boundary is computed
 * correctly without any manual offset math here.
 */
@Component
class OperationalDayService {

	private final ZoneId businessZone;
	private final Clock clock;

	OperationalDayService(@Value("${app.operations.business-timezone}") String businessTimezone, Clock clock) {
		try {
			this.businessZone = ZoneId.of(businessTimezone);
		} catch (DateTimeException e) {
			throw new IllegalStateException(
					"Invalid app.operations.business-timezone: '" + businessTimezone + "'.", e);
		}
		this.clock = clock;
	}

	/** Today's date in the configured business timezone — not the JVM's default zone. */
	LocalDate today() {
		return LocalDate.now(clock.withZone(businessZone));
	}

	/** The instant local midnight begins, for the given date, in the configured business timezone. */
	Instant startOfDay(LocalDate date) {
		return date.atStartOfDay(businessZone).toInstant();
	}

	Instant startOfToday() {
		return startOfDay(today());
	}

	/** Exclusive upper bound for "today" — the instant tomorrow's local midnight begins. */
	Instant endOfToday() {
		return startOfDay(today().plusDays(1));
	}
}
