package com.returnflow.auth.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

/**
 * Counterpart to {@link RestAuthenticationEntryPoint} for the authenticated-
 * but-not-permitted case. Exercised since Phase 2C by every
 * {@code /api/v1/admin/**} request from an authenticated non-ADMIN user (see
 * {@code SecurityConfig}'s {@code hasRole("ADMIN")} rule).
 */
@Component
class RestAccessDeniedHandler implements AccessDeniedHandler {

	private final ObjectMapper objectMapper;

	RestAccessDeniedHandler(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
			throws IOException {
		ProblemDetailResponses.write(objectMapper, response, HttpStatus.FORBIDDEN, "Forbidden",
				"You do not have permission to perform this action.");
	}
}
