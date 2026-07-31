package com.returnflow.user.dto;

import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.returnflow.user.UserRole;

/**
 * Created users are always active; there is no {@code active} field here.
 * {@code routeId} is required for {@code DRIVER} and must be absent for
 * {@code ADMIN} — enforced in {@code UserAdminService}, not by annotations
 * here, since the rule depends on {@code role}.
 */
public record CreateUserRequest(
		@NotBlank String name,
		@NotBlank @Email String email,
		@NotBlank @Size(min = 8) String password,
		@NotNull UserRole role,
		UUID routeId) {
}
