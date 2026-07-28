package com.returnflow.tenant;

/**
 * Values for the single bootstrap tenant created for the Air House pilot.
 * Shared by {@link TenantBootstrap} and {@link DefaultTenantResolver} so the
 * slug isn't duplicated as a magic string in two places.
 */
final class TenantDefaults {

	static final String WAREHOUSE_NAME = "Warehouse";
	static final String WAREHOUSE_SLUG = "warehouse";

	private TenantDefaults() {
	}
}
