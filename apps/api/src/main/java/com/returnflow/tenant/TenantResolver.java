package com.returnflow.tenant;

/**
 * Resolves which tenant the current request belongs to. The only
 * implementation today ({@link DefaultTenantResolver}) always returns the
 * single Air House pilot tenant; future phases will add resolution from
 * request context (JWT claims, headers, etc.) behind this same abstraction.
 */
public interface TenantResolver {

	Tenant resolve();
}
