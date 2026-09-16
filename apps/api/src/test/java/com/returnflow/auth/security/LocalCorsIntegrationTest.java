package com.returnflow.auth.security;

import com.returnflow.TestcontainersConfiguration;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Local development's half of the one shared CORS implementation: the
 * {@code local} profile configures {@code app.cors.allowed-origins} as the
 * Expo Web dev origin, and everything below must keep working exactly as it
 * did when this allowance was profile-gated rather than configured.
 *
 * <p>{@code ConfiguredOriginCorsIntegrationTest} is the counterpart, proving
 * the same code grants a deployed-style origin with no profile active at all.
 * That nothing is granted when no origin is configured is proven separately by
 * {@code AuthControllerIntegrationTest#corsIsNotEnabledWhenNoAllowedOriginIsConfigured()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
class LocalCorsIntegrationTest {

	private static final String ALLOWED_ORIGIN = "http://localhost:8081";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void preflightFromTheApprovedOriginToLoginSucceedsWithTheCorrectAllowOriginHeader() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
	}

	@Test
	void preflightResponseAllowsPost() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("POST")));
	}

	@Test
	void preflightResponseAllowsGetPutAndOptionsAsWell() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("GET")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("PUT")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("OPTIONS")));
	}

	@Test
	void preflightResponseAllowsTheContentTypeHeader() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, Matchers.containsStringIgnoringCase("Content-Type")));
	}

	@Test
	void anActualResponseFromTheApprovedOriginIncludesTheAllowOriginHeaderEvenWhenUnauthenticated() throws Exception {
		// CORS headers are added by a filter that runs independently of the
		// eventual auth outcome, so the browser can read even error responses
		// (e.g. to show "invalid credentials" safely) — proven here via a 401.
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN));
	}

	@Test
	void anUnknownOriginDoesNotReceiveAnAllowOriginHeader() throws Exception {
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, "http://malicious.example"))
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	@Test
	void protectedEndpointsStillRequireAuthenticationRegardlessOfOrigin() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
				.andExpect(status().isUnauthorized());
	}
}
