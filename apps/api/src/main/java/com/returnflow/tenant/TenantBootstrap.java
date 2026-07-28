package com.returnflow.tenant;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the default Warehouse tenant on startup if it doesn't already
 * exist. Idempotent: safe to run on every restart, and the unique constraint
 * on {@code tenant.slug} guarantees no duplicate is ever created even if this
 * check-then-create were somehow run concurrently.
 */
@Component
class TenantBootstrap implements ApplicationRunner {

	private final TenantRepository tenantRepository;

	TenantBootstrap(TenantRepository tenantRepository) {
		this.tenantRepository = tenantRepository;
	}

	@Override
	public void run(ApplicationArguments args) {
		ensureDefaultTenantExists();
	}

	@Transactional
	void ensureDefaultTenantExists() {
		if (tenantRepository.existsBySlug(TenantDefaults.WAREHOUSE_SLUG)) {
			return;
		}
		tenantRepository.save(new Tenant(TenantDefaults.WAREHOUSE_NAME, TenantDefaults.WAREHOUSE_SLUG, TenantStatus.ACTIVE));
	}
}
