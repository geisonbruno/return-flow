package com.returnflow.user.dto;

import java.time.Instant;
import java.util.UUID;

import com.returnflow.route.dto.RouteSummaryResponse;
import com.returnflow.user.UserRole;

/**
 * Deliberately excludes {@code passwordHash} and any refresh-token/token
 * data. {@code route} is {@code null} for an {@code ADMIN}.
 */
public record UserResponse(
		UUID id,
		String name,
		String email,
		UserRole role,
		boolean active,
		RouteSummaryResponse route,
		Instant createdAt,
		Instant updatedAt) {
}
