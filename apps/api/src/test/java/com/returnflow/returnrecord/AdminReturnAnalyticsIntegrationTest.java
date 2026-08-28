package com.returnflow.returnrecord;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.ObjectMapper;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The ADMIN Dashboard analytics endpoint — the shared-date-range foundation
 * behind Returns Over Time, Reasons Distribution, and Top Routes by Returns.
 *
 * <p>Returns are placed on specific Australia/Sydney operational calendar days
 * by backdating {@code created_at} directly, which is the only way to exercise
 * a real multi-day range here: the API itself always stamps "now".
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AdminReturnAnalyticsIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";
	private static final ZoneId SYDNEY = ZoneId.of("Australia/Sydney");
	private static final String ANALYTICS = "/api/v1/admin/dashboard/analytics";

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

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private Tenant tenant;
	private String driverToken;
	private String adminToken;
	private LocalDate today;

	@BeforeEach
	void setUp() throws Exception {
		today = LocalDate.now(SYDNEY);
		tenant = tenantRepository.save(new Tenant("Tenant", "analytics-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));
		driverToken = createDriver(tenant, route, "Driver One");
		adminToken = createAdmin(tenant, "Admin One");
	}

	// --- Returns Over Time ---

	@Test
	void returnsOverTimeCountsPerOperationalDayAndFillsMissingDaysWithZero() throws Exception {
		createReturnOn(driverToken, today.minusDays(2), "DAMAGED");
		createReturnOn(driverToken, today.minusDays(2), "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");

		mockMvc.perform(analytics(adminToken, today.minusDays(2), today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.from").value(today.minusDays(2).toString()))
				.andExpect(jsonPath("$.to").value(today.toString()))
				.andExpect(jsonPath("$.returnsOverTime.length()").value(3))
				.andExpect(jsonPath("$.returnsOverTime[0].date").value(today.minusDays(2).toString()))
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(2))
				.andExpect(jsonPath("$.returnsOverTime[1].date").value(today.minusDays(1).toString()))
				.andExpect(jsonPath("$.returnsOverTime[1].count").value(0))
				.andExpect(jsonPath("$.returnsOverTime[2].date").value(today.toString()))
				.andExpect(jsonPath("$.returnsOverTime[2].count").value(1));
	}

	@Test
	void aSameDayRangeCountsOnlyThatDay() throws Exception {
		createReturnOn(driverToken, today.minusDays(1), "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "LEAKING");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime.length()").value(1))
				.andExpect(jsonPath("$.returnsOverTime[0].date").value(today.toString()))
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(2))
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(2));
	}

	@Test
	void aRangeWithNoReturnsStillReturnsAZeroFilledSeriesAndEmptyDistributions() throws Exception {
		createReturnOn(driverToken, today, "DAMAGED");

		mockMvc.perform(analytics(adminToken, today.minusDays(10), today.minusDays(8)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime.length()").value(3))
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(0))
				.andExpect(jsonPath("$.returnsOverTime[1].count").value(0))
				.andExpect(jsonPath("$.returnsOverTime[2].count").value(0))
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(0))
				.andExpect(jsonPath("$.topRoutes.length()").value(0));
	}

	@Test
	void returnsOutsideTheRangeAreExcludedOnBothEdges() throws Exception {
		createReturnOn(driverToken, today.minusDays(3), "DAMAGED");
		createReturnOn(driverToken, today.minusDays(2), "DAMAGED");
		createReturnOn(driverToken, today.minusDays(1), "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");

		mockMvc.perform(analytics(adminToken, today.minusDays(2), today.minusDays(1)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime.length()").value(2))
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(1))
				.andExpect(jsonPath("$.returnsOverTime[1].count").value(1))
				.andExpect(jsonPath("$.reasonsDistribution[0].count").value(2));
	}

	@Test
	void analyticsIncludeEveryLifecycleStatusCreatedInTheRange() throws Exception {
		String reviewed = createReturnOn(driverToken, today, "DAMAGED");
		String cancelled = createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");

		mockMvc.perform(post("/api/v1/admin/returns/" + reviewed + "/start-review").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/admin/returns/" + cancelled + "/cancel")
						.header(HttpHeaders.AUTHORIZATION, adminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("reason", "Duplicate record"))))
				.andExpect(status().isOk());

		// The cohort is "created in the range", never "currently in some
		// status" — an IN_REVIEW and a CANCELLED return count exactly like an
		// AWAITING_WAREHOUSE one.
		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(3))
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("DAMAGED"))
				.andExpect(jsonPath("$.reasonsDistribution[0].count").value(3))
				.andExpect(jsonPath("$.topRoutes[0].count").value(3));
	}

	// --- Reasons Distribution ---

	@Test
	void reasonsDistributionAggregatesByReasonOrderedByCountDescending() throws Exception {
		createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "LEAKING");
		createReturnOn(driverToken, today, "LEAKING");
		createReturnOn(driverToken, today, "NOT_ORDERED");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(3))
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("DAMAGED"))
				.andExpect(jsonPath("$.reasonsDistribution[0].count").value(3))
				.andExpect(jsonPath("$.reasonsDistribution[1].reason").value("LEAKING"))
				.andExpect(jsonPath("$.reasonsDistribution[1].count").value(2))
				.andExpect(jsonPath("$.reasonsDistribution[2].reason").value("NOT_ORDERED"))
				.andExpect(jsonPath("$.reasonsDistribution[2].count").value(1));
	}

	@Test
	void reasonsDistributionBreaksTiesByReasonNameSoTheOrderIsDeterministic() throws Exception {
		createReturnOn(driverToken, today, "NOT_ORDERED");
		createReturnOn(driverToken, today, "DAMAGED");
		createReturnOn(driverToken, today, "LEAKING");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("DAMAGED"))
				.andExpect(jsonPath("$.reasonsDistribution[1].reason").value("LEAKING"))
				.andExpect(jsonPath("$.reasonsDistribution[2].reason").value("NOT_ORDERED"));
	}

	@Test
	void reasonsDistributionOmitsReasonsWithNoReturnsInTheRange() throws Exception {
		createReturnOn(driverToken, today, "DAMAGED");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(1))
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("DAMAGED"));
	}

	// --- Top Routes ---

	@Test
	void topRoutesAreLimitedToFiveOrderedByCountDescending() throws Exception {
		// Six routes with strictly decreasing volume: the smallest must fall off.
		for (int i = 1; i <= 6; i++) {
			Route extraRoute = routeRepository.save(new Route(tenant.getId(), "T" + i, "Top Route " + i, true));
			String token = createDriver(tenant, extraRoute, "Top Driver " + i);
			for (int j = 0; j < 7 - i; j++) {
				createReturnOn(token, today, "DAMAGED");
			}
		}

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topRoutes.length()").value(5))
				.andExpect(jsonPath("$.topRoutes[0].routeCode").value("T1"))
				.andExpect(jsonPath("$.topRoutes[0].routeName").value("Top Route 1"))
				.andExpect(jsonPath("$.topRoutes[0].count").value(6))
				.andExpect(jsonPath("$.topRoutes[4].routeCode").value("T5"))
				.andExpect(jsonPath("$.topRoutes[4].count").value(2))
				.andExpect(jsonPath("$.topRoutes[*].routeCode").value(not(hasItem("T6"))));
	}

	@Test
	void topRoutesBreakTiesByRouteCodeSoTheOrderIsDeterministic() throws Exception {
		Route routeB = routeRepository.save(new Route(tenant.getId(), "RB", "Route B", true));
		Route routeA = routeRepository.save(new Route(tenant.getId(), "RA", "Route A", true));
		createReturnOn(createDriver(tenant, routeB, "Driver B"), today, "DAMAGED");
		createReturnOn(createDriver(tenant, routeA, "Driver A"), today, "DAMAGED");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topRoutes.length()").value(2))
				.andExpect(jsonPath("$.topRoutes[0].routeCode").value("RA"))
				.andExpect(jsonPath("$.topRoutes[1].routeCode").value("RB"));
	}

	@Test
	void topRoutesStillReportARouteThatHasSinceBeenDeactivated() throws Exception {
		Route retiredRoute = routeRepository.save(new Route(tenant.getId(), "RX", "Retired Route", true));
		String retiredDriverToken = createDriver(tenant, retiredRoute, "Retired Driver");
		createReturnOn(retiredDriverToken, today, "DAMAGED");
		createReturnOn(retiredDriverToken, today, "DAMAGED");

		retiredRoute.update(retiredRoute.getCode(), retiredRoute.getName(), false);
		routeRepository.save(retiredRoute);

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.topRoutes.length()").value(1))
				.andExpect(jsonPath("$.topRoutes[0].routeId").value(retiredRoute.getId().toString()))
				.andExpect(jsonPath("$.topRoutes[0].routeCode").value("RX"))
				.andExpect(jsonPath("$.topRoutes[0].routeName").value("Retired Route"))
				.andExpect(jsonPath("$.topRoutes[0].count").value(2));
	}

	// --- Tenant isolation ---

	@Test
	void analyticsNeverIncludeAnotherTenantsReturns() throws Exception {
		createReturnOn(driverToken, today, "DAMAGED");

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "analytics-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherDriverToken = createDriver(otherTenant, otherRoute, "Other Driver");
		String otherAdminToken = createAdmin(otherTenant, "Other Admin");
		createReturnOn(otherDriverToken, today, "LEAKING");
		createReturnOn(otherDriverToken, today, "LEAKING");
		createReturnOn(otherDriverToken, today, "LEAKING");

		mockMvc.perform(analytics(adminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(1))
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(1))
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("DAMAGED"))
				.andExpect(jsonPath("$.reasonsDistribution[0].count").value(1))
				.andExpect(jsonPath("$.topRoutes.length()").value(1))
				.andExpect(jsonPath("$.topRoutes[0].routeCode").value("R1"))
				.andExpect(jsonPath("$.topRoutes[0].count").value(1));

		mockMvc.perform(analytics(otherAdminToken, today, today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.returnsOverTime[0].count").value(3))
				.andExpect(jsonPath("$.reasonsDistribution.length()").value(1))
				.andExpect(jsonPath("$.reasonsDistribution[0].reason").value("LEAKING"))
				.andExpect(jsonPath("$.reasonsDistribution[0].count").value(3))
				.andExpect(jsonPath("$.topRoutes.length()").value(1))
				.andExpect(jsonPath("$.topRoutes[0].routeCode").value("OR"))
				.andExpect(jsonPath("$.topRoutes[0].count").value(3));
	}

	// --- Authorization ---

	@Test
	void driverCannotUseTheAnalyticsEndpoint() throws Exception {
		mockMvc.perform(analytics(driverToken, today, today)).andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedAnalyticsRequestReturns401() throws Exception {
		mockMvc.perform(get(ANALYTICS).param("from", today.toString()).param("to", today.toString()))
				.andExpect(status().isUnauthorized());
	}

	// --- Validation ---

	@Test
	void aMalformedFromDateIsRejected() throws Exception {
		mockMvc.perform(get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("from", "28-08-2026").param("to", today.toString()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Filter"));
	}

	@Test
	void aMalformedToDateIsRejected() throws Exception {
		mockMvc.perform(get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("from", today.toString()).param("to", "not-a-date"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Filter"));
	}

	@Test
	void aFromDateAfterTheToDateIsRejected() throws Exception {
		mockMvc.perform(analytics(adminToken, today, today.minusDays(1)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Filter"));
	}

	@Test
	void aMissingFromOrToDateIsRejected() throws Exception {
		mockMvc.perform(get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, adminToken).param("to", today.toString()))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, adminToken).param("from", today.toString()))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isBadRequest());
	}

	// --- The existing summary endpoint stays independent ---

	@Test
	void theSummaryEndpointIsUnaffectedByAnalyticsDateRangeParameters() throws Exception {
		createReturnOn(driverToken, today.minusDays(30), "DAMAGED");
		createReturnOn(driverToken, today, "DAMAGED");

		// Even when handed the analytics range explicitly, the four
		// current-state cards keep their own today-only semantics.
		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("from", today.minusDays(30).toString()).param("to", today.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.waitingWarehouse").value(2))
				.andExpect(jsonPath("$.returnsToday").value(1));
	}

	// --- helpers ---

	private MockHttpServletRequestBuilder analytics(String token, LocalDate from, LocalDate to) {
		return get(ANALYTICS).header(HttpHeaders.AUTHORIZATION, token)
				.param("from", from.toString()).param("to", to.toString());
	}

	private String createDriver(Tenant forTenant, Route forRoute, String fullName) throws Exception {
		String email = uniqueEmail();
		userRepository.save(new User(forTenant.getId(), UserRole.DRIVER, fullName, email, email,
				passwordEncoder.encode(PASSWORD), true, forRoute.getId()));
		return login(email);
	}

	private String createAdmin(Tenant forTenant, String fullName) throws Exception {
		String email = uniqueEmail();
		userRepository.save(new User(forTenant.getId(), UserRole.ADMIN, fullName, email, email,
				passwordEncoder.encode(PASSWORD), true));
		return login(email);
	}

	/** Creates a return and moves it onto the given Sydney operational day (midday local, safely inside the day at any DST offset). */
	private String createReturnOn(String token, LocalDate operationalDate, String reason) throws Exception {
		String returnId = createReturn(token, reason);
		Instant middayLocal = operationalDate.atStartOfDay(SYDNEY).plusHours(12).toInstant();
		// created_at is a `timestamp without time zone` holding UTC wall time
		// (hibernate.jdbc.time_zone=UTC), so write exactly that rather than a
		// java.sql.Timestamp, whose conversion depends on the JVM default zone.
		jdbcTemplate.update("UPDATE return_record SET created_at = ? WHERE id = ?",
				LocalDateTime.ofInstant(middayLocal, ZoneOffset.UTC), UUID.fromString(returnId));
		return returnId;
	}

	private String createReturn(String token, String reason) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("customerName", "Customer");
		body.put("productName", "Product");
		body.put("reason", reason);
		body.put("quantity", 1);
		body.put("unit", "EA");
		body.put("observation", "Box was open");

		MvcResult result = mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body)))
				.andExpect(status().isCreated())
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
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
