package com.returnflow.returnrecord;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnSignatureRepository extends JpaRepository<ReturnSignature, UUID> {

	Optional<ReturnSignature> findByReturnRecordIdAndTenantId(UUID returnRecordId, UUID tenantId);

	boolean existsByReturnRecordId(UUID returnRecordId);
}
