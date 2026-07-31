package com.returnflow.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByNormalizedEmail(String normalizedEmail);

	boolean existsByNormalizedEmail(String normalizedEmail);

	Optional<User> findByIdAndTenantId(UUID id, UUID tenantId);

	List<User> findByTenantIdOrderByFullNameAsc(UUID tenantId);

	boolean existsByRouteIdAndActiveTrueAndRole(UUID routeId, UserRole role);
}
