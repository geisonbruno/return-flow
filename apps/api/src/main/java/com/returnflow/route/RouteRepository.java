package com.returnflow.route;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteRepository extends JpaRepository<Route, UUID> {

	Optional<Route> findByIdAndTenantId(UUID id, UUID tenantId);

	List<Route> findByTenantIdOrderByCodeAsc(UUID tenantId);

	Optional<Route> findByTenantIdAndCode(UUID tenantId, String code);

	boolean existsByTenantIdAndCode(UUID tenantId, String code);
}
