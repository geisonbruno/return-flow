package com.returnflow.returnrecord;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnRecordRepository extends JpaRepository<ReturnRecord, UUID> {

	Optional<ReturnRecord> findByIdAndTenantId(UUID id, UUID tenantId);

	Optional<ReturnRecord> findByReturnNumberAndTenantId(String returnNumber, UUID tenantId);
}
