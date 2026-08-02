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
 * Covers only the {@code local}-profile CORS allowance added for Expo Web UX
 * testing (see {@code auth.security.SecurityConfig}). Profile isolation
 * itself — that the same allowed origin gets nothing without the {@code local}
 * profile active — is proven separately by
 * {@code AuthControllerIntegrationTest#corsIsNotEnabledWithoutTheLocalProfileEvenFromTheKnownLocalOrigin()},
 * which deliberately runs with no active profile (this project's normal test
 * default).
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
