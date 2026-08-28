package com.returnflow.returnrecord;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.returnrecord.dto.AdminReturnAnalyticsResponse;
import com.returnflow.returnrecord.dto.ReasonDistributionResponse;
import com.returnflow.returnrecord.dto.ReturnsOverTimePointResponse;
import com.returnflow.returnrecord.dto.TopRouteResponse;
import com.returnflow.tenant.TenantContext;

/**
 * Read-only ADMIN analytics behind the three approved Dashboard charts —
 * Returns Over Time, Reasons Distribution, and Top Routes by Returns — all
 * computed over one shared date range ({@code docs/WEB_UX.md} §5).
 *
 * <p>Deliberately separate from {@link AdminReturnService}: the four summary
 * cards describe current/today operational state and must stay unaffected by
 * the analytics range, so nothing here touches {@code summary()}.
 *
 * <p><strong>Cohort:</strong> all three charts describe the exact same
 * population — every tenant-scoped return whose {@code createdAt} falls in the
 * selected operational calendar-date range, <em>regardless of current
 * lifecycle status</em>. A return that is now {@code CLOSED},
 * {@code IN_REVIEW}, {@code AWAITING_WAREHOUSE}, or {@code CANCELLED} counts
 * the same, because these charts describe return activity <em>created</em>
 * during the period rather than mixing {@code createdAt} and {@code closedAt}
 * semantics in one picture.
 *
 * <p>Three aggregate queries, one per chart — never one query per day, reason,
 * or route, and never a full entity load grouped in Java.
 */
@Service
class AdminReturnAnalyticsService {

	/** Root {@code CLAUDE.md} §17.1's Dashboard has room for a small, fixed set of routes, not an unbounded league table. */
	private static final int TOP_ROUTES_LIMIT = 5;

	private final ReturnRecordRepository returnRecordRepository;
	private final OperationalDayService operationalDayService;

	AdminReturnAnalyticsService(ReturnRecordRepository returnRecordRepository, OperationalDayService operationalDayService) {
		this.returnRecordRepository = returnRecordRepository;
		this.operationalDayService = operationalDayService;
	}

	@Transactional(readOnly = true)
	AdminReturnAnalyticsResponse analytics(String rawFrom, String rawTo) {
		UUID tenantId = TenantContext.get().getId();
		LocalDate from = requireDate(rawFrom);
		LocalDate to = requireDate(rawTo);
		if (from.isAfter(to)) {
			throw new InvalidReturnFilterException();
		}

		// Same inclusive-calendar-date / exclusive-instant convention as the
		// returns-list createdFrom/createdTo filters: a return dated on "to"
		// itself must match, so the real upper bound is the start of the next
		// operational day.
		Instant fromInstant = operationalDayService.startOfDay(from);
		Instant toExclusive = operationalDayService.startOfDay(to.plusDays(1));

		return new AdminReturnAnalyticsResponse(
				from,
				to,
				returnsOverTime(tenantId, from, to, fromInstant, toExclusive),
				reasonsDistribution(tenantId, fromInstant, toExclusive),
				topRoutes(tenantId, fromInstant, toExclusive));
	}

	/**
	 * Every calendar date from {@code from} through {@code to} inclusive, so
	 * the frontend line chart never has to infer a missing day. The database
	 * returns only the days that actually have returns; the gaps are filled
	 * with explicit zeros here, which is simpler and clearer than generating a
	 * date series in SQL.
	 */
	private List<ReturnsOverTimePointResponse> returnsOverTime(UUID tenantId, LocalDate from, LocalDate to,
			Instant fromInstant, Instant toExclusive) {
		Map<LocalDate, Long> countsByDate = new HashMap<>();
		for (ReturnCountByDateProjection row : returnRecordRepository.countCreatedPerOperationalDay(
				tenantId, utcWallTime(fromInstant), utcWallTime(toExclusive), operationalDayService.businessZone().getId())) {
			countsByDate.put(LocalDate.parse(row.getDay()), row.getTotal());
		}

		List<ReturnsOverTimePointResponse> points = new ArrayList<>();
		for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
			points.add(new ReturnsOverTimePointResponse(date, countsByDate.getOrDefault(date, 0L)));
		}
		return points;
	}

	/** Only reasons with at least one return in the range — an unused reason is absent, not a zero row. */
	private List<ReasonDistributionResponse> reasonsDistribution(UUID tenantId, Instant fromInstant, Instant toExclusive) {
		return returnRecordRepository.countByReasonCreatedBetween(tenantId, fromInstant, toExclusive).stream()
				.map(row -> new ReasonDistributionResponse(row.getReason(), row.getTotal()))
				.toList();
	}

	/** The busiest {@value #TOP_ROUTES_LIMIT} routes, limited in the database rather than by trimming a full list here. */
	private List<TopRouteResponse> topRoutes(UUID tenantId, Instant fromInstant, Instant toExclusive) {
		return returnRecordRepository
				.countByRouteCreatedBetween(tenantId, fromInstant, toExclusive, PageRequest.of(0, TOP_ROUTES_LIMIT)).stream()
				.map(row -> new TopRouteResponse(row.getRouteId(), row.getRouteCode(), row.getRouteName(), row.getTotal()))
				.toList();
	}

	/**
	 * Unlike the returns list's optional date filters, both bounds are required
	 * here — the backend understands explicit calendar dates only and never
	 * invents a default window such as "last 7 days," which is a frontend
	 * presentation choice. A missing or malformed value reuses the module's
	 * existing {@link InvalidReturnFilterException} (a 400 {@code ProblemDetail})
	 * rather than adding parallel error infrastructure.
	 */
	private static LocalDate requireDate(String raw) {
		if (raw == null || raw.isBlank()) {
			throw new InvalidReturnFilterException();
		}
		try {
			return LocalDate.parse(raw);
		} catch (DateTimeParseException e) {
			throw new InvalidReturnFilterException();
		}
	}

	/**
	 * {@code return_record.created_at} is a {@code timestamp without time zone}
	 * holding UTC wall time (see
	 * {@code spring.jpa.properties.hibernate.jdbc.time_zone=UTC}). The Returns
	 * Over Time aggregate is a native query, so its bounds are bound as that
	 * exact type — no implicit, JVM-default-timezone-dependent conversion sits
	 * between this service and the column. The JPQL aggregates keep binding
	 * {@link Instant}, since those go through the entity's own mapping.
	 */
	private static LocalDateTime utcWallTime(Instant instant) {
		return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
	}
}
