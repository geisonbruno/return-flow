package com.returnflow.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthControllerIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";

	/**
	 * The non-secret dev/test-only default from {@code application.properties}
	 * ({@code app.security.access-token.secret}), which is what the app's real
	 * {@code AccessTokenService} bean signs with in this test context (no
	 * profile is active under {@code @SpringBootTest}). Used only to craft a
	 * validly-signed-but-malformed token for {@link #meWithAValidlySignedTokenMissingAMandatoryClaimIsUnauthorizedNotAServerError()}.
	 */
	private static final String KNOWN_TEST_SIGNING_SECRET =
			"local-development-and-test-only-signing-secret-never-use-in-production-min-32-bytes";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private AccessTokenService accessTokenService;

	@Autowired
	private RefreshTokenService refreshTokenService;

	private Tenant tenant;
	private Tenant otherTenant;
	private User activeAdmin;

	@BeforeEach
	void setUp() {
		tenant = tenantRepository.save(new Tenant("Tenant", "auth-test-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		otherTenant = tenantRepository.save(new Tenant("Other Tenant", "auth-test-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String email = uniqueEmail();
		activeAdmin = userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Active Admin", email, email,
				passwordEncoder.encode(PASSWORD), true));
	}

	// --- Login ---

	@Test
	void validCredentialsReturnAnAccessAndRefreshSession() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());

		assertThat(session.get("accessToken").asText()).isNotBlank();
		assertThat(session.get("refreshToken").asText()).isNotBlank();
		assertThat(session.get("tokenType").asText()).isEqualTo("Bearer");
	}

	@Test
	void invalidPasswordAndUnknownEmailProduceTheIdenticalSafeError() throws Exception {
		MvcResult wrongPassword = mockMvc.perform(loginRequest(activeAdmin.getEmail(), "wrong-password"))
				.andExpect(status().isUnauthorized())
				.andReturn();
		MvcResult unknownEmail = mockMvc.perform(loginRequest("nobody-" + UUID.randomUUID() + "@warehouse.example", PASSWORD))
				.andExpect(status().isUnauthorized())
				.andReturn();

		JsonNode wrongPasswordBody = objectMapper.readTree(wrongPassword.getResponse().getContentAsString());
		JsonNode unknownEmailBody = objectMapper.readTree(unknownEmail.getResponse().getContentAsString());
		assertThat(wrongPasswordBody.get("detail").asText()).isEqualTo(unknownEmailBody.get("detail").asText());
		assertThat(wrongPasswordBody.get("title").asText()).isEqualTo(unknownEmailBody.get("title").asText());
	}

	@Test
	void inactiveUserLoginFailsWithTheSameSafeError() throws Exception {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Inactive Driver", email, email,
				passwordEncoder.encode(PASSWORD), false));

		mockMvc.perform(loginRequest(email, PASSWORD))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.detail").value("Invalid email or password."));
	}

	@Test
	void loginRequestCannotChooseATenant() throws Exception {
		Map<String, Object> payload = new LinkedHashMap<>();
		payload.put("email", activeAdmin.getEmail());
		payload.put("password", PASSWORD);
		payload.put("tenantId", otherTenant.getId().toString());

		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(payload)))
				.andExpect(status().isOk())
				.andReturn();
		String accessToken = objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();

		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tenantId").value(tenant.getId().toString()));
	}

	// --- /auth/me ---

	@Test
	void meWithoutATokenIsUnauthorizedWithASafeProblemDetailBody() throws Exception {
		mockMvc.perform(get("/api/v1/auth/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.title").value("Unauthorized"))
				.andExpect(jsonPath("$.detail").value("Authentication is required to access this resource."))
				.andExpect(jsonPath("$.trace").doesNotExist())
				.andExpect(jsonPath("$.exception").doesNotExist());
	}

	@Test
	void meWithATamperedTokenIsUnauthorizedWithASafeProblemDetailBody() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());
		String validToken = session.get("accessToken").asText();
		String tamperedToken = tamperSignature(validToken);
		assertThat(tamperedToken).isNotEqualTo(validToken);

		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + tamperedToken))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
				.andExpect(jsonPath("$.title").value("Unauthorized"))
				.andExpect(jsonPath("$.trace").doesNotExist());
	}

	@Test
	void meWithAValidlySignedTokenMissingAMandatoryClaimIsUnauthorizedNotAServerError() throws Exception {
		// Proves the AccessTokenService.validate() fix (review finding #2):
		// this used to throw an uncaught NullPointerException (raw 500)
		// instead of failing validation cleanly, because nothing prevents a
		// validly-signed JWT from simply omitting a claim.
		SecretKey key = Keys.hmacShaKeyFor(KNOWN_TEST_SIGNING_SECRET.getBytes(StandardCharsets.UTF_8));
		Instant now = Instant.now();
		String tokenMissingTenantClaim = Jwts.builder()
				.subject(UUID.randomUUID().toString())
				.claim("role", "ADMIN")
				.claim("email", "admin@warehouse.example")
				.issuedAt(Date.from(now))
				.expiration(Date.from(now.plus(Duration.ofMinutes(15))))
				.signWith(key, Jwts.SIG.HS256)
				.compact();

		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenMissingTenantClaim))
				.andExpect(status().isUnauthorized())
				.andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
				.andExpect(jsonPath("$.title").value("Unauthorized"));
	}

	@Test
	void meReturnsTheSafeUserContractWithoutThePasswordHash() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());

		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + session.get("accessToken").asText()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.userId").value(activeAdmin.getId().toString()))
				.andExpect(jsonPath("$.email").value(activeAdmin.getEmail()))
				.andExpect(jsonPath("$.role").value("ADMIN"))
				.andExpect(jsonPath("$.tenantId").value(tenant.getId().toString()))
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void meRejectsAValidlySignedTokenForANowInactiveUser() throws Exception {
		String email = uniqueEmail();
		User inactive = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Inactive Driver", email, email,
				passwordEncoder.encode(PASSWORD), false));
		String token = accessTokenService
				.issue(new AuthenticatedPrincipal(inactive.getId(), tenant.getId(), UserRole.DRIVER, email))
				.token();

		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void meIgnoresSpoofedTenantAndRoleHeaders() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());

		mockMvc.perform(get("/api/v1/auth/me")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + session.get("accessToken").asText())
						.header("X-Tenant-Id", otherTenant.getId().toString())
						.header("X-Role", "DRIVER"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.role").value("ADMIN"))
				.andExpect(jsonPath("$.tenantId").value(tenant.getId().toString()));
	}

	// --- Refresh rotation ---

	@Test
	void refreshReturnsANewRefreshToken() throws Exception {
		// Not asserting the access token also differs: JWT `iat`/`exp` are
		// second-precision by spec (RFC 7519 NumericDate) and every other claim
		// is identical, so two access tokens issued for the same principal
		// within the same second are legitimately byte-identical. Rotation is
		// a refresh-token guarantee, not an access-token one.
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());

		JsonNode rotated = refresh(session.get("refreshToken").asText(), status().isOk());

		assertThat(rotated.get("accessToken").asText()).isNotBlank();
		assertThat(rotated.get("refreshToken").asText()).isNotEqualTo(session.get("refreshToken").asText());
	}

	@Test
	void aRotatedRefreshTokenCannotBeReused() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());
		String originalRefreshToken = session.get("refreshToken").asText();
		refresh(originalRefreshToken, status().isOk());

		refresh(originalRefreshToken, status().isUnauthorized());
	}

	@Test
	void aGarbageRefreshTokenIsRejected() throws Exception {
		refresh("this-token-was-never-issued-" + UUID.randomUUID(), status().isUnauthorized());
	}

	@Test
	void refreshFailsForAnInactiveUsersSession() throws Exception {
		String email = uniqueEmail();
		User inactive = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Inactive Driver", email, email,
				passwordEncoder.encode(PASSWORD), false));
		String rawRefreshToken = refreshTokenService.issue(inactive.getId()).rawToken();

		refresh(rawRefreshToken, status().isUnauthorized());
	}

	// --- CORS profile isolation ---

	@Test
	void corsIsNotEnabledWithoutTheLocalProfileEvenFromTheKnownLocalOrigin() throws Exception {
		// The app.cors.local-origin allowance (see auth.security.SecurityConfig)
		// only exists while the "local" Spring profile is active; this test
		// class runs with no active profile (this project's normal test
		// default), so even the exact origin "local" would allow must not
		// receive an Access-Control-Allow-Origin header here.
		mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.ORIGIN, "http://localhost:8081"))
				.andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
	}

	// --- Logout ---

	@Test
	void logoutRevokesTheSessionAndFurtherRefreshFails() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());
		String refreshToken = session.get("refreshToken").asText();

		logout(refreshToken, status().isNoContent());

		refresh(refreshToken, status().isUnauthorized());
	}

	@Test
	void repeatedLogoutIsIdempotentAndDoesNotError() throws Exception {
		JsonNode session = login(activeAdmin.getEmail(), PASSWORD, status().isOk());
		String refreshToken = session.get("refreshToken").asText();

		logout(refreshToken, status().isNoContent());
		logout(refreshToken, status().isNoContent());
	}

	@Test
	void logoutWithAnUnknownTokenIsStillNoContent() throws Exception {
		logout("a-token-that-was-never-issued-" + UUID.randomUUID(), status().isNoContent());
	}

	// --- helpers ---

	private String uniqueEmail() {
		return "user-" + UUID.randomUUID() + "@warehouse.example";
	}

	/**
	 * Flips one Base64URL character in the middle of the signature segment —
	 * deliberately not the token's final character. An unpadded Base64URL
	 * trailing character can carry unused padding bits that don't affect the
	 * decoded byte value for some encoded lengths, which made a
	 * previous last-character mutation an occasional no-op (the "tampered"
	 * token still decoded to the exact same signature bytes and validated
	 * successfully — see the identical fix in {@code AccessTokenServiceTest}).
	 * A middle-of-segment character fully contributes to the decoded bytes,
	 * so this always changes the actual signature.
	 */
	private static String tamperSignature(String token) {
		String[] segments = token.split("\\.");
		if (segments.length != 3) {
			throw new IllegalArgumentException("Expected a three-segment JWT, got: " + token);
		}
		String signature = segments[2];
		int index = signature.length() / 2;
		char original = signature.charAt(index);
		char replacement = original == 'A' ? 'B' : 'A';
		String tamperedSignature = signature.substring(0, index) + replacement + signature.substring(index + 1);
		return segments[0] + "." + segments[1] + "." + tamperedSignature;
	}

	private org.springframework.test.web.servlet.RequestBuilder loginRequest(String email, String password) throws Exception {
		return post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("email", email, "password", password)));
	}

	private JsonNode login(String email, String password, org.springframework.test.web.servlet.ResultMatcher expectedStatus) throws Exception {
		MvcResult result = mockMvc.perform(loginRequest(email, password)).andExpect(expectedStatus).andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString());
	}

	private JsonNode refresh(String refreshToken, org.springframework.test.web.servlet.ResultMatcher expectedStatus) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
				.andExpect(expectedStatus)
				.andReturn();
		String body = result.getResponse().getContentAsString();
		return body.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(body);
	}

	private void logout(String refreshToken, org.springframework.test.web.servlet.ResultMatcher expectedStatus) throws Exception {
		mockMvc.perform(post("/api/v1/auth/logout")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("refreshToken", refreshToken))))
				.andExpect(expectedStatus);
	}
}
