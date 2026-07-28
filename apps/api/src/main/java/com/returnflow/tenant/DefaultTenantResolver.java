package com.returnflow.tenant;

import org.springframework.stereotype.Component;

/**
 * Always resolves the single Warehouse tenant bootstrapped at startup by
 * {@link TenantBootstrap}. This is intentionally the only resolution
 * strategy for now — request-based resolution (JWT, headers, domain, API
 * keys) belongs to later phases.
 */
@Component
class DefaultTenantResolver implements TenantResolver {

	private final TenantRepository tenantRepository;

	DefaultTenantResolver(TenantRepository tenantRepository) {
		this.tenantRepository = tenantRepository;
	}

	@Override
	public Tenant resolve() {
		return tenantRepository.findBySlug(TenantDefaults.WAREHOUSE_SLUG)
				.orElseThrow(() -> new IllegalStateException(
						"Default tenant '" + TenantDefaults.WAREHOUSE_SLUG + "' not found — bootstrap should have created it."));
	}
}
