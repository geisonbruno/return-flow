package com.returnflow.route;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class RouteAdminIntegrationTest {

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
	private String adminToken;
	private String driverToken;
	private Route routeWithAnActiveDriver;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "route-admin-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		otherTenant = tenantRepository.save(new Tenant("Other Tenant", "route-admin-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail, passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);

		routeWithAnActiveDriver = routeRepository.save(new Route(tenant.getId(), "DRV", "Driver Route", true));
		String driverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, routeWithAnActiveDriver.getId()));
		driverToken = login(driverEmail);
	}

	// --- Authorization ---

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/routes")).andExpect(status().isUnauthorized());
	}

	@Test
	void aDriverIsForbidden() throws Exception {
		mockMvc.perform(get("/api/v1/admin/routes").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.title").value("Forbidden"));
	}

	// --- Create ---

	@Test
	void adminCreatesARoute() throws Exception {
		mockMvc.perform(createRouteRequest("5", "Northern Beaches"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.code").value("5"))
				.andExpect(jsonPath("$.name").value("Northern Beaches"))
				.andExpect(jsonPath("$.active").value(true));
	}

	@Test
	void routeCodeIsNormalizedBeforeStorage() throws Exception {
		mockMvc.perform(createRouteRequest("  5b  ", "Test"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.code").value("5B"));
	}

	@Test
	void duplicateCodeInTheSameTenantIsRejected() throws Exception {
		mockMvc.perform(createRouteRequest("7", "First")).andExpect(status().isCreated());

		mockMvc.perform(createRouteRequest("7", "Second"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Duplicate Route Code"));
	}

	@Test
	void theSameCodeInAnotherTenantIsAllowed() throws Exception {
		mockMvc.perform(createRouteRequest("9", "Tenant A route")).andExpect(status().isCreated());

		String otherAdminEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", otherAdminEmail, otherAdminEmail,
				passwordEncoder.encode(PASSWORD), true));
		String otherAdminToken = login(otherAdminEmail);

		mockMvc.perform(post("/api/v1/admin/routes")
						.header(HttpHeaders.AUTHORIZATION, otherAdminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(routeBody("9", "Tenant B route"))))
				.andExpect(status().isCreated());
	}

	// --- List / get ---

	@Test
	void adminListsAndReadsRoutes() throws Exception {
		MvcResult created = mockMvc.perform(createRouteRequest("3", "Test")).andExpect(status().isCreated()).andReturn();
		String routeId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/routes").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[?(@.id=='" + routeId + "')]").exists());

		mockMvc.perform(get("/api/v1/admin/routes/" + routeId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.code").value("3"));
	}

	@Test
	void anotherTenantsRouteBehavesAsNotFound() throws Exception {
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OT1", "Other tenant route", true));

		mockMvc.perform(get("/api/v1/admin/routes/" + otherRoute.getId()).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	// --- Update ---

	@Test
	void adminUpdatesARoute() throws Exception {
		MvcResult created = mockMvc.perform(createRouteRequest("4", "Old Name")).andExpect(status().isCreated()).andReturn();
		String routeId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(updateRouteRequest(routeId, "4", "New Name", true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("New Name"));
	}

	@Test
	void aRouteAssignedToAnActiveDriverCannotBeDeactivated() throws Exception {
		mockMvc.perform(updateRouteRequest(routeWithAnActiveDriver.getId().toString(), "DRV", "Driver Route", false))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Route In Use"));
	}

	@Test
	void aRouteWithoutActiveDriversCanBeDeactivated() throws Exception {
		Route route = routeRepository.save(new Route(tenant.getId(), "EMPTY", "No drivers", true));

		mockMvc.perform(updateRouteRequest(route.getId().toString(), "EMPTY", "No drivers", false))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.active").value(false));
	}

	@Test
	void updatingARouteWithoutActiveIsRejectedAndLeavesItUnchanged() throws Exception {
		MvcResult created = mockMvc.perform(createRouteRequest("6", "Original Name")).andExpect(status().isCreated()).andReturn();
		String routeId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		// routeBody() deliberately omits "active" — proves an incomplete PUT body
		// fails validation instead of silently deserializing active to false.
		mockMvc.perform(put("/api/v1/admin/routes/" + routeId)
						.header(HttpHeaders.AUTHORIZATION, adminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(routeBody("6", "Attempted Rename"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Validation Error"));

		mockMvc.perform(get("/api/v1/admin/routes/" + routeId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Original Name"))
				.andExpect(jsonPath("$.active").value(true));
	}

	// --- helpers ---

	private RequestBuilder createRouteRequest(String code, String name) throws Exception {
		return post("/api/v1/admin/routes")
				.header(HttpHeaders.AUTHORIZATION, adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(routeBody(code, name)));
	}

	private RequestBuilder updateRouteRequest(String routeId, String code, String name, boolean active) throws Exception {
		Map<String, Object> body = routeBody(code, name);
		body.put("active", active);
		return put("/api/v1/admin/routes/" + routeId)
				.header(HttpHeaders.AUTHORIZATION, adminToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body));
	}

	private static Map<String, Object> routeBody(String code, String name) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("code", code);
		body.put("name", name);
		return body;
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
