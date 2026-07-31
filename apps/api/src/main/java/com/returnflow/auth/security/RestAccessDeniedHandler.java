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
 * but-not-permitted case. No endpoint in this phase actually restricts by
 * role, so this is unexercised by current business logic — it exists so the
 * security filter chain is fully and correctly configured for when role
 * restrictions arrive (Phase 2C onward) rather than defaulting to Spring's
 * HTML response.
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
