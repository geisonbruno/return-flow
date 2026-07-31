package com.returnflow.tenant;

import java.util.UUID;

/**
 * Resolves and validates the tenant a request is authorized to act as, given
 * a tenant ID that has already been established as trustworthy (from a
 * validated access token, never from client-supplied request data).
 *
 * <p>Before Phase 2B (authentication), the only implementation always
 * returned the bootstrapped Warehouse tenant for every request, since there
 * was no authenticated identity yet to derive a tenant from. Now that
 * authentication exists, resolution always starts from a specific tenant ID
 * and confirms it still exists and is {@link TenantStatus#ACTIVE}.
 */
public interface TenantResolver {

	Tenant resolve(UUID tenantId);
}
