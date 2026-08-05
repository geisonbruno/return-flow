package com.returnflow.returnrecord;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface ReturnRecordRepository extends JpaRepository<ReturnRecord, UUID>, JpaSpecificationExecutor<ReturnRecord> {

	Optional<ReturnRecord> findByIdAndTenantId(UUID id, UUID tenantId);

	Optional<ReturnRecord> findByReturnNumberAndTenantId(String returnNumber, UUID tenantId);

	/** Used by {@code AdminReturnService} for the "Waiting Warehouse" / future status-based dashboard cards. */
	long countByTenantIdAndStatus(UUID tenantId, ReturnStatus status);

	/** Used by {@code AdminReturnService} for the "Returns Today" dashboard card — {@code from} inclusive, {@code to} exclusive. */
	long countByTenantIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(UUID tenantId, Instant from, Instant to);

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
}
