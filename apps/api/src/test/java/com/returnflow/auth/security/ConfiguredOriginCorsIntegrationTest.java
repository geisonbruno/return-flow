package com.returnflow.auth.security;

import com.returnflow.TestcontainersConfiguration;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The deployment case: CORS granted purely from configuration, with **no
 * active Spring profile at all** (this project's normal test default). That
 * absence is the whole point — before this, the only CORS allowance lived
 * under the {@code local} profile, so a deployed Web app on its own origin
 * received no CORS headers and every browser call failed.
 *
 * <p>{@code https://returnflow.example} is a deliberately fictional
 * deployment-shaped origin: HTTPS, a real domain name, nothing resembling
 * localhost, and no hosting provider named. The counterpart
 * {@code LocalCorsIntegrationTest} proves the same single implementation
 * still serves local development.
 */
@SpringBootTest(properties = "app.cors.allowed-origins=https://returnflow.example")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ConfiguredOriginCorsIntegrationTest {

	private static final String CONFIGURED_ORIGIN = "https://returnflow.example";

	@Autowired
	private MockMvc mockMvc;

	@Test
	void preflightFromTheConfiguredDeployedOriginSucceedsWithoutTheLocalProfile() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CONFIGURED_ORIGIN));
	}

	@Test
	void preflightAllowsTheMethodsTheWebClientActuallyUses() throws Exception {
		// GET reads, POST logs in and drives review actions, PUT edits users
		// and routes. PUT is the one the previous local-only configuration
		// omitted entirely, which would have broken Users and Routes editing
		// even if that configuration had been reused for a deployment.
		mockMvc.perform(options("/api/v1/admin/users/11111111-1111-1111-1111-111111111111")
						.header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CONFIGURED_ORIGIN))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("GET")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("POST")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("PUT")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, Matchers.containsString("OPTIONS")));
	}

	@Test
	void preflightAllowsTheAuthorizationAndContentTypeHeadersTheClientSends() throws Exception {
		// Every authenticated call carries the bearer token in Authorization,
		// and every write carries Content-Type — a preflight that refused
		// either would block the whole authenticated Web app.
		mockMvc.perform(options("/api/v1/admin/returns")
						.header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
						Matchers.containsStringIgnoringCase("Authorization")))
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS,
						Matchers.containsStringIgnoringCase("Content-Type")));
	}

	@Test
	void anActualResponseFromTheConfiguredOriginCarriesTheAllowOriginHeader() throws Exception {
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN))
				.andExpect(status().isUnauthorized())
				.andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, CONFIGURED_ORIGIN));
	}

	@Test
	void credentialsAreNotAllowedBecauseAuthenticationIsBearerTokenNotCookies() throws Exception {
		mockMvc.perform(options("/api/v1/auth/login")
						.header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN)
						.header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
				.andExpect(status().isOk())
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
	}

	@Test
	void anOriginThatIsNotConfiguredReceivesNoAllowOriginHeader() throws Exception {
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, "https://malicious.example"))
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	@Test
	void aLookalikeOriginIsNotTreatedAsTheConfiguredOne() throws Exception {
		// Exact-match only: no suffix/prefix matching, no origin reflection.
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, "https://returnflow.example.attacker.test"))
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	@Test
	void configuringCorsDoesNotMakeAnyBusinessEndpointPublic() throws Exception {
		// CORS is a browser-side permission, never an authorization decision:
		// the same 401s must still come back from the allowed origin.
		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void publicEndpointsKeepBehavingExactlyAsBefore() throws Exception {
		mockMvc.perform(get("/actuator/health").header(HttpHeaders.ORIGIN, CONFIGURED_ORIGIN))
				.andExpect(status().isOk());
	}
}
