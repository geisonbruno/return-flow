package com.returnflow.user;

import java.util.Map;
import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
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
import org.springframework.test.web.servlet.RequestBuilder;

import tools.jackson.databind.ObjectMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PasswordResetIntegrationTest {

	private static final String OLD_PASSWORD = "old-password-123";
	private static final String NEW_PASSWORD = "new-password-456";

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

	private Tenant tenant;
	private String adminToken;
	private User target;
	private String targetRefreshToken;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "password-reset-" + UUID.randomUUID(), TenantStatus.ACTIVE));

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail,
				passwordEncoder.encode(OLD_PASSWORD), true));
		adminToken = login(adminEmail);

		String targetEmail = uniqueEmail();
		target = userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Target", targetEmail, targetEmail,
				passwordEncoder.encode(OLD_PASSWORD), true));

		MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("email", targetEmail, "password", OLD_PASSWORD))))
				.andExpect(status().isOk())
				.andReturn();
		targetRefreshToken = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("refreshToken").asText();
	}

	@Test
	void adminResetsAUsersPassword() throws Exception {
		mockMvc.perform(resetPasswordRequest(target.getId().toString(), NEW_PASSWORD)).andExpect(status().isNoContent());
	}

	@Test
	void oldPasswordNoLongerAuthenticatesAfterReset() throws Exception {
		mockMvc.perform(resetPasswordRequest(target.getId().toString(), NEW_PASSWORD)).andExpect(status().isNoContent());

		mockMvc.perform(loginRequest(target.getEmail(), OLD_PASSWORD)).andExpect(status().isUnauthorized());
	}

	@Test
	void newPasswordAuthenticatesAfterReset() throws Exception {
		mockMvc.perform(resetPasswordRequest(target.getId().toString(), NEW_PASSWORD)).andExpect(status().isNoContent());

		mockMvc.perform(loginRequest(target.getEmail(), NEW_PASSWORD)).andExpect(status().isOk());
	}

	@Test
	void existingRefreshSessionsAreRevokedAfterReset() throws Exception {
		mockMvc.perform(resetPasswordRequest(target.getId().toString(), NEW_PASSWORD)).andExpect(status().isNoContent());

		mockMvc.perform(post("/api/v1/auth/refresh")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("refreshToken", targetRefreshToken))))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void anotherTenantsUserCannotBeReset() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other Tenant", "password-reset-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String otherEmail = uniqueEmail();
		User otherUser = userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other", otherEmail, otherEmail,
				passwordEncoder.encode(OLD_PASSWORD), true));

		mockMvc.perform(resetPasswordRequest(otherUser.getId().toString(), NEW_PASSWORD)).andExpect(status().isNotFound());
	}

	// --- helpers ---

	private RequestBuilder resetPasswordRequest(String userId, String newPassword) throws Exception {
		return post("/api/v1/admin/users/" + userId + "/reset-password")
				.header(HttpHeaders.AUTHORIZATION, adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("newPassword", newPassword)));
	}

	private RequestBuilder loginRequest(String email, String password) throws Exception {
		return post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("email", email, "password", password)));
	}

	private String uniqueEmail() {
		return "user-" + UUID.randomUUID() + "@warehouse.example";
	}

	private String login(String email) throws Exception {
		MvcResult result = mockMvc.perform(loginRequest(email, OLD_PASSWORD)).andExpect(status().isOk()).andReturn();
		return "Bearer " + objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
	}
}
