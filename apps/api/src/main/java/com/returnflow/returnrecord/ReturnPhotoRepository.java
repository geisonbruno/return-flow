package com.returnflow.returnrecord;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnPhotoRepository extends JpaRepository<ReturnPhoto, UUID> {

	List<ReturnPhoto> findByReturnRecordIdAndTenantIdOrderByPositionAsc(UUID returnRecordId, UUID tenantId);

	int countByReturnRecordId(UUID returnRecordId);

	Optional<ReturnPhoto> findByIdAndReturnRecordIdAndTenantId(UUID id, UUID returnRecordId, UUID tenantId);
}
