package com.returnflow.auth.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import tools.jackson.databind.ObjectMapper;

/**
 * Spring Security's default behavior for an unauthenticated request to a
 * protected endpoint is an HTML login-redirect response, which is wrong for
 * a JSON API. This produces the same {@code ProblemDetail} shape as every
 * other error in the project instead. Covers every access-token failure mode
 * uniformly (missing header, invalid/expired/tampered token, resolved-tenant
 * no-longer-active) since {@code JwtAuthenticationFilter} never distinguishes
 * them — an unauthenticated request is an unauthenticated request.
 */
@Component
class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private final ObjectMapper objectMapper;

	RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
			throws IOException {
		ProblemDetailResponses.write(objectMapper, response, HttpStatus.UNAUTHORIZED, "Unauthorized",
				"Authentication is required to access this resource.");
	}
}
