package com.returnflow.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Deliberately just email + password: accepting a tenant ID, role, user ID,
 * active state, or token claims here would let a client choose trusted
 * identity data, which is never permitted.
 */
public record LoginRequest(@NotBlank String email, @NotBlank String password) {
}
