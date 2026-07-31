package com.returnflow.tenant;

import java.util.UUID;

/**
 * Thrown by {@link DefaultTenantResolver} when the tenant a caller is trying
 * to resolve doesn't exist or is no longer {@link TenantStatus#ACTIVE}. The
 * security filter that's currently the only caller treats this the same as
 * "not authenticated" rather than surfacing it as a distinct error — see
 * {@code auth.security.JwtAuthenticationFilter}.
 */
public class TenantNotActiveException extends RuntimeException {

	public TenantNotActiveException(UUID tenantId) {
		super("Tenant '" + tenantId + "' does not exist or is not active.");
	}
}
