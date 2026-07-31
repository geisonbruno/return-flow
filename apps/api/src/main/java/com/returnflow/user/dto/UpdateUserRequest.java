package com.returnflow.user.dto;

import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.returnflow.user.UserRole;

/**
 * A full replace, matching PUT semantics — not a partial patch. {@code active}
 * is a nullable {@code Boolean} (not primitive) specifically so an omitted
 * field fails {@code @NotNull} validation instead of silently deserializing
 * to {@code false} and deactivating the user.
 */
public record UpdateUserRequest(
		@NotBlank String name,
		@NotBlank @Email String email,
		@NotNull UserRole role,
		UUID routeId,
		@NotNull Boolean active) {
}
