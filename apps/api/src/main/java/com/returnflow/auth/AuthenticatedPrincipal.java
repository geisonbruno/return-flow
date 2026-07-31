package com.returnflow.auth;

import java.util.UUID;

import com.returnflow.user.UserRole;

/**
 * Trusted, server-derived identity for the current request — built only from
 * a validated access token plus the database rows it points at, never from
 * client-supplied tenant/role/user data. This is what Spring Security holds
 * as the {@code Authentication} principal for every protected request.
 */
public record AuthenticatedPrincipal(UUID userId, UUID tenantId, UserRole role, String email) {
}
