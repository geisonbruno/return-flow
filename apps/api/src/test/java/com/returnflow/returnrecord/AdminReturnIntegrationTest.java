package com.returnflow.returnrecord;

import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AdminReturnIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";
	private static final byte[] JPEG_MAGIC = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	@TempDir
	static Path storageRoot;

	@DynamicPropertySource
	static void storageProperties(DynamicPropertyRegistry registry) {
		registry.add("app.storage.return-media.root", () -> storageRoot.toString());
	}

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
	private Route route;
	private User driver;
	private String driverToken;
	private String adminToken;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "admin-returns-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		driver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin One", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);
	}

	// --- Summary ---

	@Test
	void summaryReportsWaitingWarehouseAndReturnsTodayWithHonestZerosForNotYetImplementedStates() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");
		createReturn(driverToken, "Customer B", "Product B");

		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.waitingWarehouse").value(2))
				.andExpect(jsonPath("$.inReview").value(0))
				.andExpect(jsonPath("$.closedToday").value(0))
				.andExpect(jsonPath("$.returnsToday").value(2));
	}

	@Test
	void summaryIsIsolatedPerTenant() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-returns-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherAdminEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", otherAdminEmail, otherAdminEmail,
				passwordEncoder.encode(PASSWORD), true));
		String otherAdminToken = login(otherAdminEmail);
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		String otherDriverToken = login(otherDriverEmail);
		createReturn(otherDriverToken, "Customer C", "Product C");
		createReturn(otherDriverToken, "Customer D", "Product D");

		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.waitingWarehouse").value(1));
		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, otherAdminToken))
				.andExpect(jsonPath("$.waitingWarehouse").value(2));
	}

	@Test
	void returnsTodayExcludesAReturnCreatedYesterday() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		backdateCreatedAt(returnId, Instant.now().minus(2, ChronoUnit.DAYS));

		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.returnsToday").value(0))
				.andExpect(jsonPath("$.waitingWarehouse").value(1));
	}

	@Test
	void summaryOnAnEmptyTenantReportsAllZeros() throws Exception {
		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.waitingWarehouse").value(0))
				.andExpect(jsonPath("$.inReview").value(0))
				.andExpect(jsonPath("$.closedToday").value(0))
				.andExpect(jsonPath("$.returnsToday").value(0));
	}

	@Test
	void driverCannotUseTheSummaryEndpoint() throws Exception {
		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedSummaryRequestReturns401() throws Exception {
		mockMvc.perform(get("/api/v1/admin/dashboard/summary")).andExpect(status().isUnauthorized());
	}

	// --- List: authorization and isolation ---

	@Test
	void adminCanListReturnsInTheirTenant() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	@Test
	void driverCannotUseTheAdminListEndpoint() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedListRequestReturns401() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns")).andExpect(status().isUnauthorized());
	}

	@Test
	void listNeverReturnsAnotherTenantsReturns() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-returns-list-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		createReturn(login(otherDriverEmail), "Customer Other", "Product Other");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	// --- List: pagination and ordering ---

	@Test
	void listPaginatesWithCorrectMetadata() throws Exception {
		for (int i = 0; i < 5; i++) {
			createReturn(driverToken, "Customer " + i, "Product " + i);
		}

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("page", "0").param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").value(5))
				.andExpect(jsonPath("$.totalPages").value(3));
	}

	@Test
	void listOrdersNewestFirstDeterministically() throws Exception {
		createReturn(driverToken, "Customer Older", "Product Older");
		createReturn(driverToken, "Customer Newer", "Product Newer");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer Newer"))
				.andExpect(jsonPath("$.content[1].customerName").value("Customer Older"));
	}

	@Test
	void listOnAnEmptyTenantReturnsAnEmptyPageNotAnError() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	// --- List: search ---

	@Test
	void searchMatchesReturnNumberCustomerProductDriverAndRoute() throws Exception {
		String returnId = createReturn(driverToken, "Zebra Traders", "Widget X200");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "zebra"))
				.andExpect(jsonPath("$.content.length()").value(1));
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "widget"))
				.andExpect(jsonPath("$.content.length()").value(1));
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "driver one"))
				.andExpect(jsonPath("$.content.length()").value(1));
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "r1"))
				.andExpect(jsonPath("$.content.length()").value(1));
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("search", returnNumberOf(returnId, adminToken).substring(0, 6)))
				.andExpect(jsonPath("$.content.length()").value(1));
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "no-match-xyz"))
				.andExpect(jsonPath("$.content.length()").value(0));
	}

	// --- List: filters ---

	@Test
	void statusFilterMatchesAwaitingWarehouse() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("status", "AWAITING_WAREHOUSE"))
				.andExpect(jsonPath("$.content.length()").value(1));
	}

	@Test
	void reasonFilterMatchesExactly() throws Exception {
		createReturnWithReason(driverToken, "Customer A", "Product A", "DAMAGED");
		createReturnWithReason(driverToken, "Customer B", "Product B", "LEAKING");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("reason", "DAMAGED"))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	@Test
	void dateRangeFilterIncludesOnlyReturnsWithinTheRange() throws Exception {
		String insideId = createReturn(driverToken, "Customer Inside", "Product Inside");
		String outsideId = createReturn(driverToken, "Customer Outside", "Product Outside");
		backdateCreatedAt(outsideId, Instant.now().minus(10, ChronoUnit.DAYS));

		String today = java.time.LocalDate.now(java.time.ZoneId.of("Australia/Sydney")).toString();
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("createdFrom", today).param("createdTo", today))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].id").value(insideId));
	}

	@Test
	void driverFilterMatchesOnlyThatDriversReturns() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		createReturn(login(otherDriverEmail), "Customer B", "Product B");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("driverId", driver.getId().toString()))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	@Test
	void routeFilterMatchesOnlyReturnsOnThatRoute() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");
		Route otherRoute = routeRepository.save(new Route(tenant.getId(), "R2", "Route Two", true));
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Route Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		createReturn(login(otherDriverEmail), "Customer B", "Product B");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("routeId", route.getId().toString()))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	@Test
	void combinedFiltersNarrowResultsTogether() throws Exception {
		createReturnWithReason(driverToken, "Customer A", "Product A", "DAMAGED");
		createReturnWithReason(driverToken, "Customer B", "Product B", "DAMAGED");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("reason", "DAMAGED").param("search", "customer a"))
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].customerName").value("Customer A"));
	}

	@Test
	void noMatchingResultsReturnsAnEmptyPageNotAnError() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("search", "definitely-not-present"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	// --- List: invalid parameters ---

	@Test
	void negativePageIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("page", "-1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Page Request"));
	}

	@Test
	void zeroSizeIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("size", "0"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void sizeAboveMaximumIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("size", "101"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void unrecognizedStatusFilterIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("status", "NOT_A_REAL_STATUS"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Filter"));
	}

	@Test
	void unrecognizedReasonFilterIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("reason", "NOT_A_REAL_REASON"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void malformedDateFilterIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("createdFrom", "not-a-date"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void fromDateAfterToDateIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("createdFrom", "2026-08-10").param("createdTo", "2026-08-01"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void unknownDriverOrRouteFilterYieldsEmptyResultsNotAnError() throws Exception {
		createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("driverId", UUID.randomUUID().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0));
	}

	@Test
	void malformedDriverIdIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken).param("driverId", "not-a-uuid"))
				.andExpect(status().isBadRequest());
	}

	// --- Detail ---

	@Test
	void adminCanViewCompleteSameTenantDetail() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(returnId))
				.andExpect(jsonPath("$.customerName").value("Customer A"))
				.andExpect(jsonPath("$.productName").value("Product A"))
				.andExpect(jsonPath("$.status").value("AWAITING_WAREHOUSE"))
				.andExpect(jsonPath("$.driver.fullName").value("Driver One"))
				.andExpect(jsonPath("$.route.code").value("R1"))
				.andExpect(jsonPath("$.photos").isArray())
				.andExpect(jsonPath("$.signature").isEmpty());
	}

	@Test
	void detailForAnotherTenantsReturnIsNotFound() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-returns-detail-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String otherAdminEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", otherAdminEmail, otherAdminEmail,
				passwordEncoder.encode(PASSWORD), true));
		String otherAdminToken = login(otherAdminEmail);

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, otherAdminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void detailForAMissingReturnIsNotFound() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns/" + UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void driverCannotUseTheAdminDetailEndpoint() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden());
	}

	@Test
	void detailReportsPhotosInPositionOrderAndSignatureMetadataWithoutStorageKeysOrPaths() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());
		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());
		signReturn(driverToken, returnId, "Jane Doe");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.photos.length()").value(2))
				.andExpect(jsonPath("$.photos[0].position").value(1))
				.andExpect(jsonPath("$.photos[1].position").value(2))
				.andExpect(jsonPath("$.photos[0].contentPath").value("/api/v1/admin/returns/" + returnId + "/photos/" + photoIdAt(returnId, 0) + "/content"))
				.andExpect(jsonPath("$.signature.signerName").value("Jane Doe"))
				.andExpect(jsonPath("$.signature.contentPath").value("/api/v1/admin/returns/" + returnId + "/signature/content"))
				.andExpect(jsonPath("$..storageKey").doesNotExist())
				.andExpect(jsonPath("$..filePath").doesNotExist())
				.andExpect(jsonPath("$..tenantId").doesNotExist())
				.andExpect(jsonPath("$..driverId").doesNotExist());
	}

	// --- Media ---

	@Test
	void adminCanRetrieveTheExactPhotoBytesWithASafeContentType() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		byte[] original = jpegBytes(2048);
		MvcResult uploaded = mockMvc.perform(uploadPhotoRequest(driverToken, returnId, original)).andExpect(status().isCreated()).andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/photos/" + photoId + "/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/jpeg"))
				.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
				.andExpect(result -> assertThat(result.getResponse().getContentAsByteArray()).isEqualTo(original));
	}

	@Test
	void adminCanRetrieveTheSignatureSvgWithASafeContentType() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		signReturn(driverToken, returnId, "Jane Doe");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(header().stringValues(HttpHeaders.CONTENT_TYPE, org.hamcrest.Matchers.contains("image/svg+xml")))
				.andExpect(header().string("X-Content-Type-Options", "nosniff"))
				.andExpect(result -> assertThat(result.getResponse().getContentAsString()).contains("<svg"));
	}

	@Test
	void driverCannotUseTheAdminMediaEndpoints() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		MvcResult uploaded = mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated()).andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/photos/" + photoId + "/content").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isForbidden());
	}

	@Test
	void crossTenantPhotoAccessIsNotFound() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		MvcResult uploaded = mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated()).andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-returns-media-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String otherAdminEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", otherAdminEmail, otherAdminEmail,
				passwordEncoder.encode(PASSWORD), true));
		String otherAdminToken = login(otherAdminEmail);

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/photos/" + photoId + "/content").header(HttpHeaders.AUTHORIZATION, otherAdminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void mismatchedReturnAndPhotoIsNotFound() throws Exception {
		String returnId1 = createReturn(driverToken, "Customer A", "Product A");
		String returnId2 = createReturn(driverToken, "Customer B", "Product B");
		MvcResult uploaded = mockMvc.perform(uploadPhotoRequest(driverToken, returnId1, jpegBytes(100))).andExpect(status().isCreated()).andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId2 + "/photos/" + photoId + "/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void signatureContentForAPendingSignatureIsNotFound() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void unauthenticatedMediaAccessReturns401() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		MvcResult uploaded = mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated()).andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/photos/" + photoId + "/content")).andExpect(status().isUnauthorized());
	}

	// --- helpers ---

	private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder uploadPhotoRequest(String token, String returnId, byte[] content) {
		return multipart("/api/v1/driver/returns/" + returnId + "/photos")
				.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", content))
				.header(HttpHeaders.AUTHORIZATION, token);
	}

	private static byte[] jpegBytes(int totalSize) {
		byte[] bytes = new byte[Math.max(totalSize, JPEG_MAGIC.length)];
		System.arraycopy(JPEG_MAGIC, 0, bytes, 0, JPEG_MAGIC.length);
		return bytes;
	}

	private void signReturn(String token, String returnId, String signerName) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("signerName", signerName);
		body.put("strokes", java.util.List.of(java.util.List.of(
				Map.of("x", 0.10, "y", 0.50), Map.of("x", 0.20, "y", 0.40), Map.of("x", 0.35, "y", 0.55), Map.of("x", 0.50, "y", 0.35))));
		mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
						.header(HttpHeaders.AUTHORIZATION, token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body)))
				.andExpect(status().isCreated());
	}

	private String photoIdAt(String returnId, int index) throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).get(index).get("id").asText();
	}

	private String returnNumberOf(String returnId, String adminAuthToken) throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminAuthToken)).andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).get("returnNumber").asText();
	}

	private void backdateCreatedAt(String returnId, Instant instant) {
		jdbcTemplate.update("UPDATE return_record SET created_at = ? WHERE id = ?", java.sql.Timestamp.from(instant), UUID.fromString(returnId));
	}

	private String createReturn(String token, String customerName, String productName) throws Exception {
		return createReturnWithReason(token, customerName, productName, "DAMAGED");
	}

	private String createReturnWithReason(String token, String customerName, String productName, String reason) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("customerName", customerName);
		body.put("productName", productName);
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
