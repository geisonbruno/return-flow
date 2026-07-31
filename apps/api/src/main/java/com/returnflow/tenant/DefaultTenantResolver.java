package com.returnflow.tenant;

import java.util.UUID;

import org.springframework.stereotype.Component;

/**
 * Looks the tenant up by the ID carried in the authenticated principal and
 * confirms it is still {@link TenantStatus#ACTIVE}. This is the only
 * resolution strategy in V1 (single shared schema, no per-tenant routing) —
 * it exists as its own class/interface pair so callers depend on the
 * {@link TenantResolver} abstraction rather than a concrete repository
 * lookup, matching the rest of this module's boundary.
 */
@Component
class DefaultTenantResolver implements TenantResolver {

	private final TenantRepository tenantRepository;

	DefaultTenantResolver(TenantRepository tenantRepository) {
		this.tenantRepository = tenantRepository;
	}

	@Override
	public Tenant resolve(UUID tenantId) {
		return tenantRepository.findById(tenantId)
				.filter(tenant -> tenant.getStatus() == TenantStatus.ACTIVE)
				.orElseThrow(() -> new TenantNotActiveException(tenantId));
	}
}
