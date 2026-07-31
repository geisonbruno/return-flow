package com.returnflow.auth.security;

import java.io.IOException;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import tools.jackson.databind.ObjectMapper;

/**
 * Writes a {@link ProblemDetail} body directly to a servlet response. Only
 * needed for the two Spring Security hooks ({@link RestAuthenticationEntryPoint},
 * {@link RestAccessDeniedHandler}) that run outside Spring MVC's normal
 * exception-resolution path — {@code AuthenticationException}/
 * {@code AccessDeniedException} thrown from a filter never reach
 * {@code @RestControllerAdvice}, which only intercepts exceptions a
 * controller method throws.
 */
final class ProblemDetailResponses {

	private ProblemDetailResponses() {
	}

	static void write(ObjectMapper objectMapper, HttpServletResponse response, HttpStatus status, String title,
			String detail) throws IOException {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		response.setStatus(status.value());
		response.setContentType("application/problem+json");
		objectMapper.writeValue(response.getWriter(), problem);
	}
}
