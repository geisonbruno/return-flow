package com.returnflow.user;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.route.Route;
import com.returnflow.route.RouteRepository;
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

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class UserAdminIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private RouteRepository routeRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	private Tenant tenant;
	private Tenant otherTenant;
	private User admin;
	private String adminToken;
	private String driverToken;
	private Route activeRoute;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "user-admin-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		otherTenant = tenantRepository.save(new Tenant("Other Tenant", "user-admin-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));

		String adminEmail = uniqueEmail();
		admin = userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);

		activeRoute = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Existing Driver", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, activeRoute.getId()));
		driverToken = login(driverEmail);
	}

	// --- Authorization ---

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
	}

	@Test
	void aDriverIsForbidden() throws Exception {
		mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.title").value("Forbidden"));
	}

	// --- Create ---

	@Test
	void adminCreatesADriverWithAnActiveRoute() throws Exception {
		mockMvc.perform(createUserRequest("Geison", uniqueEmail(), UserRole.DRIVER, activeRoute.getId()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("DRIVER"))
				.andExpect(jsonPath("$.route.id").value(activeRoute.getId().toString()))
				.andExpect(jsonPath("$.active").value(true));
	}

	@Test
	void adminCreatesAnAdminWithoutARoute() throws Exception {
		MvcResult result = mockMvc.perform(createUserRequest("Second Admin", uniqueEmail(), UserRole.ADMIN, null))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.role").value("ADMIN"))
				.andReturn();

		JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
		assertThat(body.get("route").isNull()).isTrue();
	}

	@Test
	void aDriverWithoutARouteIsRejected() throws Exception {
		mockMvc.perform(createUserRequest("No Route Driver", uniqueEmail(), UserRole.DRIVER, null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("An active DRIVER requires a route."));
	}

	@Test
	void anAdminWithARouteIsRejected() throws Exception {
		mockMvc.perform(createUserRequest("Bad Admin", uniqueEmail(), UserRole.ADMIN, activeRoute.getId()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("An ADMIN must not have a route."));
	}

	@Test
	void inactiveRouteAssignmentIsRejected() throws Exception {
		Route inactive = routeRepository.save(new Route(tenant.getId(), "INACT", "Inactive", false));

		mockMvc.perform(createUserRequest("Driver", uniqueEmail(), UserRole.DRIVER, inactive.getId()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("The selected route is not active."));
	}

	@Test
	void crossTenantRouteAssignmentIsRejected() throws Exception {
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OTR", "Other tenant route", true));

		mockMvc.perform(createUserRequest("Driver", uniqueEmail(), UserRole.DRIVER, otherRoute.getId()))
				.andExpect(status().isNotFound());
	}

	@Test
	void duplicateNormalizedEmailIsRejected() throws Exception {
		String email = uniqueEmail();
		mockMvc.perform(createUserRequest("First", email, UserRole.ADMIN, null)).andExpect(status().isCreated());

		mockMvc.perform(createUserRequest("Second", email.toUpperCase(), UserRole.ADMIN, null))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Duplicate Email"));
	}

	// --- List / get / update ---

	@Test
	void adminListsReadsAndUpdatesUsers() throws Exception {
		MvcResult created = mockMvc.perform(createUserRequest("Driver To Update", uniqueEmail(), UserRole.DRIVER, activeRoute.getId()))
				.andExpect(status().isCreated())
				.andReturn();
		String userId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.id=='" + userId + "')]").exists());

		mockMvc.perform(get("/api/v1/admin/users/" + userId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Driver To Update"));

		mockMvc.perform(updateUserRequest(userId, "Renamed Driver", uniqueEmail(), UserRole.DRIVER, activeRoute.getId(), true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Renamed Driver"));
	}

	@Test
	void anotherTenantsUserBehavesAsNotFound() throws Exception {
		String otherEmail = uniqueEmail();
		User otherUser = userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other", otherEmail, otherEmail,
				passwordEncoder.encode(PASSWORD), true));

		mockMvc.perform(get("/api/v1/admin/users/" + otherUser.getId()).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void activeDriverCannotBeLeftWithoutARoute() throws Exception {
		MvcResult created = mockMvc.perform(createUserRequest("Driver", uniqueEmail(), UserRole.DRIVER, activeRoute.getId()))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode createdBody = objectMapper.readTree(created.getResponse().getContentAsString());
		String userId = createdBody.get("id").asText();
		String email = createdBody.get("email").asText();

		mockMvc.perform(updateUserRequest(userId, "Driver", email, UserRole.DRIVER, null, true))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.detail").value("An active DRIVER requires a route."));
	}

	@Test
	void currentAdminCannotDeactivateThemselves() throws Exception {
		mockMvc.perform(updateUserRequest(admin.getId().toString(), admin.getFullName(), admin.getEmail(), UserRole.ADMIN, null, false))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Self-Deactivation Not Allowed"));
	}

	@Test
	void currentAdminCannotRemoveTheirOwnAdminRole() throws Exception {
		mockMvc.perform(updateUserRequest(admin.getId().toString(), admin.getFullName(), admin.getEmail(), UserRole.DRIVER,
						activeRoute.getId(), true))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Self Role Change Not Allowed"));
	}

	@Test
	void responsesNeverExposeThePasswordHash() throws Exception {
		mockMvc.perform(get("/api/v1/admin/users/" + admin.getId()).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void updatingAUserWithoutActiveIsRejectedAndLeavesItUnchanged() throws Exception {
		MvcResult created = mockMvc.perform(createUserRequest("Original Name", uniqueEmail(), UserRole.DRIVER, activeRoute.getId()))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode createdBody = objectMapper.readTree(created.getResponse().getContentAsString());
		String userId = createdBody.get("id").asText();
		String email = createdBody.get("email").asText();

		// Deliberately omits "active" — proves an incomplete PUT body fails
		// validation instead of silently deserializing active to false.
		Map<String, Object> bodyWithoutActive = new LinkedHashMap<>();
		bodyWithoutActive.put("name", "Attempted Rename");
		bodyWithoutActive.put("email", email);
		bodyWithoutActive.put("role", UserRole.DRIVER.name());
		bodyWithoutActive.put("routeId", activeRoute.getId().toString());

		mockMvc.perform(put("/api/v1/admin/users/" + userId)
						.header(HttpHeaders.AUTHORIZATION, adminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(bodyWithoutActive)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Validation Error"));

		mockMvc.perform(get("/api/v1/admin/users/" + userId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Original Name"))
				.andExpect(jsonPath("$.active").value(true));
	}

	// --- helpers ---

	private RequestBuilder createUserRequest(String name, String email, UserRole role, UUID routeId) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("name", name);
		body.put("email", email);
		body.put("password", PASSWORD);
		body.put("role", role.name());
		body.put("routeId", routeId == null ? null : routeId.toString());
		return post("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body));
	}

	private RequestBuilder updateUserRequest(String userId, String name, String email, UserRole role, UUID routeId, boolean active)
			throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("name", name);
		body.put("email", email);
		body.put("role", role.name());
		body.put("routeId", routeId == null ? null : routeId.toString());
		body.put("active", active);
		return put("/api/v1/admin/users/" + userId)
				.header(HttpHeaders.AUTHORIZATION, adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body));
	}

	private String uniqueEmail() {
		return "user-" + UUID.randomUUID() + "@warehouse.example";
	}

	private String login(String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
				.andExpect(status().isOk())
				.andReturn();
		return "Bearer " + objectMapper.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
	}
}
