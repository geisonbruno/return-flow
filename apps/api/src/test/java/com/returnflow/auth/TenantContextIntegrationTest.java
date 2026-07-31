package com.returnflow.auth;

import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantContext;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.tenant.support.TenantProbeController;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves that, since Phase 2B, {@link TenantContext} is populated only for
 * authenticated requests and only from the authenticated principal's own
 * tenant — never from client-supplied request data — replacing Phase 2A's
 * {@code TenantFilterIntegrationTest} (which tested the now-deleted
 * always-resolve-the-default-tenant filter). Uses {@link TenantProbeController}
 * (test-only fixture, unchanged from Phase 2A) as the observation point.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TenantContextIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private AccessTokenService accessTokenService;

	@Test
	void requestWithoutATokenIsRejectedAndNeverPopulatesTenantContext() throws Exception {
		mockMvc.perform(get("/test-fixture/tenant/current-slug"))
				.andExpect(status().isUnauthorized());

		assertThat(TenantContext.get()).isNull();
	}

	@Test
	void authenticatedUserAResolvesTenantAAndUserBResolvesTenantB() throws Exception {
		Tenant tenantA = tenantRepository.save(new Tenant("Tenant A", "tenant-a-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Tenant tenantB = tenantRepository.save(new Tenant("Tenant B", "tenant-b-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		User userA = createAdmin(tenantA);
		User userB = createAdmin(tenantB);

		mockMvc.perform(get("/test-fixture/tenant/current-slug").header(HttpHeaders.AUTHORIZATION, bearerFor(userA, tenantA)))
				.andExpect(status().isOk())
				.andExpect(content().string(tenantA.getSlug()));
		assertThat(TenantContext.get()).isNull();

		mockMvc.perform(get("/test-fixture/tenant/current-slug").header(HttpHeaders.AUTHORIZATION, bearerFor(userB, tenantB)))
				.andExpect(status().isOk())
				.andExpect(content().string(tenantB.getSlug()));
		assertThat(TenantContext.get()).isNull();
	}

	@Test
	void aSpoofedTenantHeaderCannotSwitchTheResolvedTenant() throws Exception {
		Tenant tenantA = tenantRepository.save(new Tenant("Tenant A", "spoof-a-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Tenant tenantB = tenantRepository.save(new Tenant("Tenant B", "spoof-b-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		User userA = createAdmin(tenantA);

		mockMvc.perform(get("/test-fixture/tenant/current-slug")
						.header(HttpHeaders.AUTHORIZATION, bearerFor(userA, tenantA))
						.header("X-Tenant-Id", tenantB.getId().toString()))
				.andExpect(status().isOk())
				.andExpect(content().string(tenantA.getSlug()));
	}

	@Test
	void tenantContextIsClearedEvenWhenTheDownstreamHandlerThrows() throws Exception {
		Tenant tenant = tenantRepository.save(new Tenant("Tenant C", "tenant-c-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		User user = createAdmin(tenant);

		mockMvc.perform(get("/test-fixture/tenant/boom").header(HttpHeaders.AUTHORIZATION, bearerFor(user, tenant)))
				.andExpect(status().isInternalServerError());

		assertThat(TenantContext.get()).isNull();
	}

	private User createAdmin(Tenant tenant) {
		String email = "admin-" + UUID.randomUUID() + "@warehouse.example";
		return userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", email, email,
				passwordEncoder.encode("irrelevant-password"), true));
	}

	private String bearerFor(User user, Tenant tenant) {
		AuthenticatedPrincipal principal = new AuthenticatedPrincipal(user.getId(), tenant.getId(), user.getRole(), user.getNormalizedEmail());
		return "Bearer " + accessTokenService.issue(principal).token();
	}
}
