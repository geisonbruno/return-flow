package com.returnflow.tenant;

/**
 * Values for the single bootstrap tenant created for the Warehouse pilot.
 * Shared by {@link TenantBootstrap}, {@link DefaultTenantResolver}, and the
 * {@code user} package's admin bootstrap so the slug isn't duplicated as a
 * magic string in multiple places.
 */
public final class TenantDefaults {

	public static final String WAREHOUSE_NAME = "Warehouse";
	public static final String WAREHOUSE_SLUG = "warehouse";

	private TenantDefaults() {
	}
}
