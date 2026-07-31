package com.returnflow.auth.dto;

import java.util.UUID;

import com.returnflow.user.UserRole;

/**
 * The {@code /auth/me} contract. Deliberately excludes password hash,
 * refresh-token information, and raw token claims — only what a client
 * legitimately needs to know about itself.
 */
public record AuthenticatedUserResponse(UUID userId, String fullName, String email, UserRole role, UUID tenantId,
		String tenantName) {
}
