package com.returnflow.returnrecord;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ReturnRecordRepository extends JpaRepository<ReturnRecord, UUID>, JpaSpecificationExecutor<ReturnRecord> {

	Optional<ReturnRecord> findByIdAndTenantId(UUID id, UUID tenantId);

	Optional<ReturnRecord> findByReturnNumberAndTenantId(String returnNumber, UUID tenantId);

	/** Used by {@code AdminReturnService} for the "Waiting Warehouse" and "In Review" status-based dashboard cards. */
	long countByTenantIdAndStatus(UUID tenantId, ReturnStatus status);

	/** Used by {@code AdminReturnService} for the "Returns Today" dashboard card — {@code from} inclusive, {@code to} exclusive. */
	long countByTenantIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UUID tenantId, Instant from, Instant to);

	/** Used by {@code AdminReturnService} for the "Closed Today" dashboard card — {@code from} inclusive, {@code to} exclusive. */
	long countByTenantIdAndStatusAndClosedAtGreaterThanEqualAndClosedAtLessThan(UUID tenantId, ReturnStatus status, Instant from, Instant to);

	/**
	 * Dashboard analytics — Returns Over Time. Counts returns per <em>operational
	 * calendar date</em> (the same Australia/Sydney business day
	 * {@code OperationalDayService} defines) in a single grouped aggregate, so no
	 * {@code ReturnRecord} is ever loaded into Java just to be counted and no
	 * query is issued per day.
	 *
	 * <p>Native SQL because JPQL has no timezone-aware date bucketing.
	 * {@code created_at} is a {@code timestamp without time zone} holding UTC
	 * wall time (see {@code spring.jpa.properties.hibernate.jdbc.time_zone=UTC}
	 * in {@code application.properties}), hence the explicit
	 * {@code AT TIME ZONE 'UTC' AT TIME ZONE :businessZone} conversion before
	 * the date is taken. {@code from}/{@code to} are bound as UTC
	 * {@code LocalDateTime} for the same reason — an unqualified range predicate
	 * against the raw column, which stays index-friendly
	 * ({@code idx_return_record_created_at}) unlike a predicate over the
	 * converted date.
	 *
	 * <p>Only days that actually have returns come back; the zero-count calendar
	 * days in between are filled in by {@code AdminReturnAnalyticsService}, which
	 * is clearer than generating a date series in SQL.
	 *
	 * <p>{@code from} inclusive, {@code to} exclusive, exactly like every other
	 * date-range query here.
	 */
	@Query(value = """
			SELECT to_char((r.created_at AT TIME ZONE 'UTC' AT TIME ZONE :businessZone)::date, 'YYYY-MM-DD') AS day,
			       count(*) AS total
			FROM return_record r
			WHERE r.tenant_id = :tenantId
			  AND r.created_at >= :from
			  AND r.created_at < :to
			GROUP BY 1
			ORDER BY 1
			""", nativeQuery = true)
	List<ReturnCountByDateProjection> countCreatedPerOperationalDay(
			@Param("tenantId") UUID tenantId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to,
			@Param("businessZone") String businessZone);

	/**
	 * Dashboard analytics — Reasons Distribution. One grouped aggregate over the
	 * same population as {@link #countCreatedPerOperationalDay}; reasons with no
	 * returns in the range simply do not appear. Ordered by count descending with
	 * the reason itself as a deterministic tie-breaker (it is persisted as its
	 * enum name, so the tie-break is a stable alphabetical one).
	 */
	@Query("""
			select r.reason as reason, count(r) as total
			from ReturnRecord r
			where r.tenant.id = :tenantId and r.createdAt >= :from and r.createdAt < :to
			group by r.reason
			order by count(r) desc, r.reason asc
			""")
	List<ReturnCountByReasonProjection> countByReasonCreatedBetween(
			@Param("tenantId") UUID tenantId, @Param("from") Instant from, @Param("to") Instant to);

	/**
	 * Dashboard analytics — Top Routes by Returns. One grouped aggregate over the
	 * same population, joined through {@code ReturnRecord.route} (the route
	 * recorded at creation), so a route that was later deactivated still shows
	 * its historical returns — the join deliberately does not filter on
	 * {@code route.active}. Ordered by count descending with the tenant-unique,
	 * normalized route {@code code} as the deterministic tie-breaker; the caller
	 * passes a {@link Pageable} to apply the top-N limit in the database rather
	 * than trimming a full list in Java.
	 */
	@Query("""
			select route.id as routeId, route.code as routeCode, route.name as routeName, count(r) as total
			from ReturnRecord r join r.route route
			where r.tenant.id = :tenantId and r.createdAt >= :from and r.createdAt < :to
			group by route.id, route.code, route.name
			order by count(r) desc, route.code asc
			""")
	List<ReturnCountByRouteProjection> countByRouteCreatedBetween(
			@Param("tenantId") UUID tenantId, @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);

	/** Newest first, with {@code id} as a stable tiebreaker for returns created in the same instant. */
	List<ReturnRecord> findByTenantIdAndDriverIdOrderByCreatedAtDescIdDesc(UUID tenantId, UUID driverId);

	Optional<ReturnRecord> findByIdAndTenantIdAndDriverId(UUID id, UUID tenantId, UUID driverId);

	/**
	 * Row-locking variant used only by {@code ReturnPhotoService} before
	 * counting existing photos and assigning the next position — serializes
	 * concurrent photo uploads to the <em>same</em> return (uploads to
	 * different returns never block each other) so two requests can never
	 * both observe "4 photos" and both insert position 5. The database's
	 * {@code chk_return_photo_position_range}/{@code uk_return_photo_return_position}
	 * constraints remain a backstop beneath this, not a substitute for it.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from ReturnRecord r where r.id = :id and r.tenant.id = :tenantId and r.driver.id = :driverId")
	Optional<ReturnRecord> findByIdAndTenantIdAndDriverIdForUpdate(
			@Param("id") UUID id, @Param("tenantId") UUID tenantId, @Param("driverId") UUID driverId);

	/**
	 * Row-locking variant used by {@code AdminReturnReviewService} for every
	 * warehouse-review lifecycle mutation (start/release/take-over/close/
	 * cancel) — serializes concurrent lifecycle attempts on the <em>same</em>
	 * return (mutations to different returns never block each other) so, for
	 * example, two concurrent Start Review calls can never both observe
	 * {@code AWAITING_WAREHOUSE} and both "win." No driver scoping: unlike
	 * the DRIVER-owned variant above, ADMIN operations are tenant-scoped
	 * only.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from ReturnRecord r where r.id = :id and r.tenant.id = :tenantId")
	Optional<ReturnRecord> findByIdAndTenantIdForUpdate(@Param("id") UUID id, @Param("tenantId") UUID tenantId);
}
