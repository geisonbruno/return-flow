package com.returnflow.auth.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Direct unit test of {@link RestAccessDeniedHandler} — no Spring context,
 * no MockMvc. No endpoint in this phase is actually role-restricted (see the
 * handler's own Javadoc: it exists purely to complete the security chain
 * ahead of Phase 2C), so there is no real 403 flow to exercise this through
 * without inventing authorization functionality ahead of its phase.
 * {@link MockHttpServletRequest}/{@link MockHttpServletResponse} are real,
 * concrete servlet-API implementations from Spring's test support — not a
 * mocking-framework double — consistent with this codebase's no-mocks
 * convention.
 */
class RestAccessDeniedHandlerTest {

	@Test
	void writesASafe403ProblemDetailBodyWithoutLeakingExceptionDetails() throws Exception {
		RestAccessDeniedHandler handler = new RestAccessDeniedHandler(new ObjectMapper());
		MockHttpServletRequest request = new MockHttpServletRequest();
		MockHttpServletResponse response = new MockHttpServletResponse();

		handler.handle(request, response, new AccessDeniedException("internal detail that must never reach the client"));

		assertThat(response.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
		assertThat(response.getContentType()).startsWith("application/problem+json");

		JsonNode body = new ObjectMapper().readTree(response.getContentAsString());
		assertThat(body.get("status").asInt()).isEqualTo(403);
		assertThat(body.get("title").asText()).isEqualTo("Forbidden");
		assertThat(body.get("detail").asText()).isEqualTo("You do not have permission to perform this action.");
		assertThat(response.getContentAsString()).doesNotContain("internal detail");
	}
}
