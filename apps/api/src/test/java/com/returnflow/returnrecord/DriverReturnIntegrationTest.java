package com.returnflow.returnrecord;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.route.Route;
import com.returnflow.route.RouteRepository;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class DriverReturnIntegrationTest {

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
	private Route route;
	private User driver;
	private String driverToken;
	private String adminToken;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "driver-return-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		driver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);
	}

	// --- Authorization ---

	@Test
	void unauthenticatedCreateIsRejected() throws Exception {
		mockMvc.perform(post("/api/v1/driver/returns")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void unauthenticatedListIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns")).andExpect(status().isUnauthorized());
	}

	@Test
	void anAdminIsForbiddenFromTheDriverApi() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.title").value("Forbidden"));
	}

	@Test
	void anAdminCannotCreateThroughTheDriverApi() throws Exception {
		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, adminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isForbidden());
	}

	// --- Create: success ---

	@Test
	void driverCreatesAReturn() throws Exception {
		mockMvc.perform(createReturnRequest(validBody()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.returnNumber").value(org.hamcrest.Matchers.matchesPattern("RF-\\d{6,}")))
				.andExpect(jsonPath("$.customerName").value("Market ABC"))
				.andExpect(jsonPath("$.reason").value("DAMAGED"))
				.andExpect(jsonPath("$.reasonDetails").doesNotExist())
				.andExpect(jsonPath("$.otherReasonDetails").doesNotExist())
				.andExpect(jsonPath("$.quantity").value(2))
				.andExpect(jsonPath("$.unit").value("EA"))
				.andExpect(jsonPath("$.observation").value("Box was open"))
				.andExpect(jsonPath("$.status").value("AWAITING_WAREHOUSE"))
				.andExpect(jsonPath("$.driver.id").value(driver.getId().toString()))
				.andExpect(jsonPath("$.driver.fullName").value("Driver One"))
				.andExpect(jsonPath("$.route.id").value(route.getId().toString()))
				.andExpect(jsonPath("$.route.code").value("R1"))
				.andExpect(jsonPath("$.createdAt").exists());
	}

	@Test
	void driverCreatesAReturnWithCtnUnit() throws Exception {
		Map<String, Object> body = validBody();
		body.put("unit", "CTN");

		MvcResult created = mockMvc.perform(createReturnRequest(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.unit").value("CTN"))
				.andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		// Re-fetches from a separate request/transaction, proving CTN was
		// actually persisted rather than merely echoed back in the create response.
		mockMvc.perform(get("/api/v1/driver/returns/" + id).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.unit").value("CTN"));
	}

	@Test
	void otherReasonWithDetailsIsAccepted() throws Exception {
		Map<String, Object> body = validBody();
		body.put("reason", "OTHER");
		body.put("reasonDetails", "Customer changed their mind after delivery");

		mockMvc.perform(createReturnRequest(body))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.reason").value("OTHER"))
				.andExpect(jsonPath("$.reasonDetails").value("Customer changed their mind after delivery"))
				.andExpect(jsonPath("$.otherReasonDetails").doesNotExist());
	}

	// --- Canonical reason contract (root CLAUDE.md §10) ---

	@Test
	void everyCanonicalReasonValueIsAccepted() throws Exception {
		for (String reason : java.util.List.of("WRONG_ITEM_DELIVERED", "EXTRA_ITEM", "MISSING_ITEM",
				"CUSTOMER_CHARGE_REQUIRED", "NO_LONGER_REQUIRED", "WRONG_ITEM_ORDERED", "EXCHANGE_REQUIRED",
				"DAMAGED", "LEAKING", "NOT_ORDERED")) {
			Map<String, Object> body = validBody();
			body.put("reason", reason);

			mockMvc.perform(createReturnRequest(body))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.reason").value(reason));
		}

		Map<String, Object> otherBody = validBody();
		otherBody.put("reason", "OTHER");
		otherBody.put("reasonDetails", "Some free-text explanation");

		mockMvc.perform(createReturnRequest(otherBody))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.reason").value("OTHER"));
	}

	@Test
	void everyRemovedTemporaryPhase3bReasonValueIsRejected() throws Exception {
		for (String obsoleteReason : java.util.List.of("DELIVERED_WRONG", "EXTRA", "MISSING", "NEEDS_CHARGE",
				"NOT_NEEDED", "WRONG_ORDER", "EXCHANGE")) {
			String rawJson = objectMapper.writeValueAsString(validBody()).replace("\"DAMAGED\"", "\"" + obsoleteReason + "\"");

			mockMvc.perform(post("/api/v1/driver/returns")
							.header(HttpHeaders.AUTHORIZATION, driverToken)
							.contentType(MediaType.APPLICATION_JSON)
							.content(rawJson))
					.andExpect(status().isBadRequest());
		}
	}

	// --- Create: field validation ---

	@Test
	void missingCustomerNameIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.remove("customerName");

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void missingReasonIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.remove("reason");

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void anUnknownReasonCodeIsRejected() throws Exception {
		String rawJson = objectMapper.writeValueAsString(validBody()).replace("\"DAMAGED\"", "\"NOT_A_REAL_REASON\"");

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(rawJson))
				.andExpect(status().isBadRequest());
	}

	@Test
	void aPhase3aOnlyReasonCodeIsNoLongerAccepted() throws Exception {
		String rawJson = objectMapper.writeValueAsString(validBody()).replace("\"DAMAGED\"", "\"DAMAGED_PRODUCT\"");

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(rawJson))
				.andExpect(status().isBadRequest());
	}

	@Test
	void otherReasonWithoutDetailsIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.put("reason", "OTHER");

		mockMvc.perform(createReturnRequest(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Reason Details"));
	}

	@Test
	void detailsProvidedForANonOtherReasonAreRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.put("reasonDetails", "Unwanted details");

		mockMvc.perform(createReturnRequest(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Reason Details"));
	}

	@Test
	void missingQuantityIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.remove("quantity");

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void zeroQuantityIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.put("quantity", 0);

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void negativeQuantityIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.put("quantity", -1);

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void missingUnitIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.remove("unit");

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	@Test
	void anUnknownUnitCodeIsRejected() throws Exception {
		String rawJson = objectMapper.writeValueAsString(validBody()).replace("\"EA\"", "\"KG\"");

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(rawJson))
				.andExpect(status().isBadRequest());
	}

	@Test
	void theRemovedCtUnitCodeIsRejected() throws Exception {
		String rawJson = objectMapper.writeValueAsString(validBody()).replace("\"EA\"", "\"CT\"");

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(rawJson))
				.andExpect(status().isBadRequest())
				.andExpect(content().contentTypeCompatibleWith(MediaType.valueOf("application/problem+json")))
				.andExpect(jsonPath("$.title").exists())
				.andExpect(jsonPath("$.trace").doesNotExist())
				.andExpect(jsonPath("$.exception").doesNotExist());
	}

	@Test
	void missingObservationIsRejected() throws Exception {
		Map<String, Object> body = validBody();
		body.remove("observation");

		mockMvc.perform(createReturnRequest(body)).andExpect(status().isBadRequest());
	}

	// --- Create: driver/route operational state ---

	@Test
	void anInactiveDriverIsRejected() throws Exception {
		User inactive = userRepository.findById(driver.getId()).orElseThrow();
		inactive.update(inactive.getFullName(), inactive.getEmail(), inactive.getNormalizedEmail(), inactive.getRole(),
				inactive.getRouteId(), false);
		userRepository.save(inactive);

		mockMvc.perform(createReturnRequest(validBody()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Inactive Driver"));
	}

	@Test
	void aDriverWithoutARouteIsRejected() throws Exception {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Routeless Driver", email, email,
				passwordEncoder.encode(PASSWORD), true, null));
		String routelessToken = login(email);

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, routelessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Driver Without Route"));
	}

	@Test
	void anInactiveRouteIsRejected() throws Exception {
		Route inactiveRoute = routeRepository.save(new Route(tenant.getId(), "INACT", "Inactive", false));
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver On Inactive Route", email, email,
				passwordEncoder.encode(PASSWORD), true, inactiveRoute.getId()));
		String token = login(email);

		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Inactive Route"));
	}

	// --- List ---

	@Test
	void driverListsOnlyTheirOwnReturnsNewestFirst() throws Exception {
		MvcResult first = mockMvc.perform(createReturnRequest(validBody())).andExpect(status().isCreated()).andReturn();
		MvcResult second = mockMvc.perform(createReturnRequest(validBody())).andExpect(status().isCreated()).andReturn();
		String firstId = objectMapper.readTree(first.getResponse().getContentAsString()).get("id").asText();
		String secondId = objectMapper.readTree(second.getResponse().getContentAsString()).get("id").asText();

		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		String otherDriverToken = login(otherDriverEmail);
		mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, otherDriverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].id").value(secondId))
				.andExpect(jsonPath("$[1].id").value(firstId));
	}

	@Test
	void aDriverWithNoReturnsSeesAnEmptyList() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	// --- Detail ---

	@Test
	void driverReadsTheirOwnReturnDetail() throws Exception {
		MvcResult created = mockMvc.perform(createReturnRequest(validBody())).andExpect(status().isCreated()).andReturn();
		String id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/driver/returns/" + id).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(id));
	}

	@Test
	void aNonexistentReturnIsNotFound() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherDriversReturnBehavesAsNotFound() throws Exception {
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		String otherDriverToken = login(otherDriverEmail);
		MvcResult created = mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, otherDriverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isCreated())
				.andReturn();
		String otherDriversReturnId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/driver/returns/" + otherDriversReturnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantsReturnBehavesAsNotFound() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "driver-return-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherTenantDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Tenant Driver", otherTenantDriverEmail,
				otherTenantDriverEmail, passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		String otherTenantDriverToken = login(otherTenantDriverEmail);
		MvcResult created = mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, otherTenantDriverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(validBody())))
				.andExpect(status().isCreated())
				.andReturn();
		String otherTenantsReturnId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/driver/returns/" + otherTenantsReturnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound());
	}

	// --- helpers ---

	private RequestBuilder createReturnRequest(Map<String, Object> body) throws Exception {
		return post("/api/v1/driver/returns")
				.header(HttpHeaders.AUTHORIZATION, driverToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body));
	}

	private static Map<String, Object> validBody() {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("customerName", "Market ABC");
		body.put("reason", "DAMAGED");
		body.put("quantity", 2);
		body.put("unit", "EA");
		body.put("observation", "Box was open");
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
