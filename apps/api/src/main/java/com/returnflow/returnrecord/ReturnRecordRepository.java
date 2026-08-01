package com.returnflow.returnrecord;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnRecordRepository extends JpaRepository<ReturnRecord, UUID> {

	Optional<ReturnRecord> findByIdAndTenantId(UUID id, UUID tenantId);

	Optional<ReturnRecord> findByReturnNumberAndTenantId(String returnNumber, UUID tenantId);

	/** Newest first, with {@code id} as a stable tiebreaker for returns created in the same instant. */
	List<ReturnRecord> findByTenantIdAndDriverIdOrderByCreatedAtDescIdDesc(UUID tenantId, UUID driverId);

	Optional<ReturnRecord> findByIdAndTenantIdAndDriverId(UUID id, UUID tenantId, UUID driverId);
}
