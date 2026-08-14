package com.returnflow.returnrecord;

import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 7A — the complete server-authoritative warehouse-review lifecycle:
 * Start Review, Release Review, Take Over Review, Close, Cancel, terminal
 * immutability, concurrency, tenant isolation, and authorization.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AdminReturnReviewIntegrationTest {

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
	private String driverToken;
	private String adminToken;
	private UUID adminId;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "admin-review-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		User admin = userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin One", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminId = admin.getId();
		adminToken = login(adminEmail);
	}

	// --- Start Review ---

	@Test
	void adminCanStartReviewFromAwaitingWarehouse() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		startReview(adminToken, returnId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("IN_REVIEW"))
				.andExpect(jsonPath("$.reviewer.id").value(adminId.toString()))
				.andExpect(jsonPath("$.reviewer.fullName").value("Admin One"))
				.andExpect(jsonPath("$.reviewStartedAt").isNotEmpty());
	}

	@Test
	void openingReturnDetailsNeverStartsAReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("AWAITING_WAREHOUSE"));
	}

	@Test
	void startReviewFailsWhenAlreadyInReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		String secondAdminToken = login(createAdmin("Admin Two"));
		startReview(secondAdminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Return Already In Review"))
				.andExpect(jsonPath("$.currentReviewerName").value("Admin One"));
	}

	@Test
	void startReviewFailsFromClosed() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		startReview(adminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Invalid Return State"));
	}

	@Test
	void driverCannotStartReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(driverToken, returnId).andExpect(status().isForbidden());
	}

	@Test
	void adminFromAnotherTenantCannotStartReviewOnThisTenantsReturn() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		String otherTenantAdminToken = loginNewTenantAdmin();

		startReview(otherTenantAdminToken, returnId).andExpect(status().isNotFound());
	}

	@Test
	void concurrentStartReviewHasExactlyOneWinner() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		int attempts = 6;
		List<String> adminTokens = new ArrayList<>();
		for (int i = 0; i < attempts; i++) {
			adminTokens.add(login(createAdmin("Concurrent Admin " + i)));
		}

		ExecutorService executor = Executors.newFixedThreadPool(attempts);
		CountDownLatch ready = new CountDownLatch(attempts);
		CountDownLatch start = new CountDownLatch(1);
		List<Callable<Integer>> tasks = new ArrayList<>();
		for (String token : adminTokens) {
			tasks.add(() -> {
				ready.countDown();
				start.await();
				return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/start-review")
								.header(HttpHeaders.AUTHORIZATION, token))
						.andReturn().getResponse().getStatus();
			});
		}

		List<Future<Integer>> futures = new ArrayList<>();
		for (Callable<Integer> task : tasks) {
			futures.add(executor.submit(task));
		}
		ready.await();
		start.countDown();

		List<Integer> statuses = new ArrayList<>();
		for (Future<Integer> future : futures) {
			statuses.add(future.get(30, TimeUnit.SECONDS));
		}
		executor.shutdown();

		long wins = statuses.stream().filter(s -> s == 200).count();
		long conflicts = statuses.stream().filter(s -> s == 409).count();
		assertThat(wins).isEqualTo(1);
		assertThat(conflicts).isEqualTo(attempts - 1);

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.status").value("IN_REVIEW"));
	}

	// --- Release Review ---

	@Test
	void ownerCanReleaseReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		releaseReview(adminToken, returnId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("AWAITING_WAREHOUSE"))
				.andExpect(jsonPath("$.reviewer").isEmpty());
	}

	@Test
	void nonOwnerCannotReleaseReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		String otherAdminToken = login(createAdmin("Admin Two"));

		releaseReview(otherAdminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Review Ownership Conflict"))
				.andExpect(jsonPath("$.currentReviewerName").value("Admin One"));
	}

	@Test
	void releaseReviewFailsWhenNotInReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		releaseReview(adminToken, returnId).andExpect(status().isConflict());
	}

	@Test
	void afterReleaseDriverCanEditAgain() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		releaseReview(adminToken, returnId).andExpect(status().isOk());

		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(64))).andExpect(status().isCreated());
	}

	// --- Take Over Review ---

	@Test
	void anotherAdminCanTakeOverAnActiveReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		String secondAdminEmail = createAdmin("Admin Two");
		String secondAdminToken = login(secondAdminEmail);
		UUID secondAdminId = userRepository.findByNormalizedEmail(secondAdminEmail).orElseThrow().getId();

		takeOver(secondAdminToken, returnId, adminId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("IN_REVIEW"))
				.andExpect(jsonPath("$.reviewer.id").value(secondAdminId.toString()));
	}

	@Test
	void staleTakeoverIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		String secondAdminToken = login(createAdmin("Admin Two"));
		String thirdAdminToken = login(createAdmin("Admin Three"));

		// Admin Two legitimately takes over from Admin One.
		takeOver(secondAdminToken, returnId, adminId).andExpect(status().isOk());

		// Admin Three observed Admin One as the reviewer (now stale) and
		// attempts to take over based on that outdated information.
		takeOver(thirdAdminToken, returnId, adminId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Stale Takeover"));
	}

	@Test
	void takeOverFailsWhenNotInReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		String secondAdminToken = login(createAdmin("Admin Two"));

		takeOver(secondAdminToken, returnId, adminId).andExpect(status().isConflict());
	}

	// --- Close ---

	@Test
	void ownerCanCloseWithAllRequiredFields() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		closeReturn(adminToken, returnId, Map.of())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CLOSED"))
				.andExpect(jsonPath("$.sellable").value(true))
				.andExpect(jsonPath("$.creditCustomer").value(false))
				.andExpect(jsonPath("$.chargeCustomer").value(false))
				.andExpect(jsonPath("$.chargeDriver").value(false))
				.andExpect(jsonPath("$.warehouseObservation").value("All good"))
				.andExpect(jsonPath("$.warehouseRepresentativeName").value("Warehouse Rep"))
				.andExpect(jsonPath("$.warehouseSignature.signerName").value("Warehouse Rep"))
				.andExpect(jsonPath("$.warehouseSignature.contentPath").value("/api/v1/admin/returns/" + returnId + "/warehouse-signature/content"))
				.andExpect(jsonPath("$.closedBy.id").value(adminId.toString()))
				.andExpect(jsonPath("$.closedAt").isNotEmpty());
	}

	@Test
	void closeMissingSellableIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("sellable", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeMissingCreditCustomerIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("creditCustomer", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeMissingChargeCustomerIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("chargeCustomer", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeMissingChargeDriverIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("chargeDriver", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeMissingWarehouseRepresentativeNameIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("warehouseRepresentativeName", "   ");
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeMissingSignatureStrokesIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("warehouseSignatureStrokes", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());
	}

	@Test
	void closeWithABlankSignatureIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("warehouseSignatureStrokes", List.of(List.of(Map.of("x", 0.5, "y", 0.5), Map.of("x", 0.5, "y", 0.5))));
		closeReturn(adminToken, returnId, overrides)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Signature"));
	}

	@Test
	void closeByNonOwnerIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		String otherAdminToken = login(createAdmin("Admin Two"));

		closeReturn(otherAdminToken, returnId, Map.of())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Review Ownership Conflict"));
	}

	@Test
	void closeFromAwaitingWarehouseIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isConflict());
	}

	@Test
	void closeNeverLeavesAPartiallyClosedRecordOnValidationFailure() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		Map<String, Object> overrides = new LinkedHashMap<>();
		overrides.put("sellable", null);
		closeReturn(adminToken, returnId, overrides).andExpect(status().isBadRequest());

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.status").value("IN_REVIEW"))
				.andExpect(jsonPath("$.warehouseSignature").isEmpty());
	}

	// --- Warehouse signature content ---

	@Test
	void adminCanRetrieveTheWarehouseSignatureSvgAfterClose() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/warehouse-signature/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andExpect(result -> assertThat(result.getResponse().getContentAsString()).contains("<svg"));
	}

	@Test
	void warehouseSignatureContentBeforeCloseIsNotFound() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/warehouse-signature/content").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isNotFound());
	}

	// --- Cancel ---

	@Test
	void adminCanCancelFromAwaitingWarehouse() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		cancelReturn(adminToken, returnId, "Customer withdrew the return")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.cancellationReason").value("Customer withdrew the return"))
				.andExpect(jsonPath("$.cancelledBy.id").value(adminId.toString()))
				.andExpect(jsonPath("$.cancelledAt").isNotEmpty());
	}

	@Test
	void adminCanCancelFromInReview() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		cancelReturn(adminToken, returnId, "Warehouse decided to cancel")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"));
	}

	@Test
	void cancelWithoutAReasonIsRejected() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/cancel")
						.header(HttpHeaders.AUTHORIZATION, adminToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(Map.of("reason", "  "))))
				.andExpect(status().isBadRequest());
	}

	@Test
	void driverCannotCancel() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");

		cancelReturn(driverToken, returnId, "Not allowed").andExpect(status().isForbidden());
	}

	// --- Terminal immutability ---

	@Test
	void everyLifecycleActionIsRejectedOnAClosedReturn() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		startReview(adminToken, returnId).andExpect(status().isConflict());
		releaseReview(adminToken, returnId).andExpect(status().isConflict());
		takeOver(adminToken, returnId, adminId).andExpect(status().isConflict());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isConflict());
		cancelReturn(adminToken, returnId, "Too late").andExpect(status().isConflict());
	}

	@Test
	void everyLifecycleActionIsRejectedOnACancelledReturn() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		cancelReturn(adminToken, returnId, "Customer withdrew").andExpect(status().isOk());

		startReview(adminToken, returnId).andExpect(status().isConflict());
		releaseReview(adminToken, returnId).andExpect(status().isConflict());
		takeOver(adminToken, returnId, adminId).andExpect(status().isConflict());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isConflict());
		cancelReturn(adminToken, returnId, "Too late").andExpect(status().isConflict());
	}

	// --- Driver editing restrictions ---

	@Test
	void driverPhotoUploadIsBlockedOnceReviewStarts() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(64))).andExpect(status().isCreated());
		startReview(adminToken, returnId).andExpect(status().isOk());

		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(64)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Return Not Editable"));
	}

	@Test
	void driverSignatureCaptureIsBlockedOnceReviewStarts() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		signCustomer(driverToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Return Not Editable"));
	}

	@Test
	void driverPhotoUploadIsBlockedAfterClosed() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		mockMvc.perform(uploadPhotoRequest(driverToken, returnId, jpegBytes(64))).andExpect(status().isConflict());
	}

	@Test
	void driverSeesAuthoritativeStatusAfterClose() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CLOSED"));
	}

	// --- Dashboard ---

	@Test
	void dashboardInReviewReflectsRealStartedReviews() throws Exception {
		String returnId = createReturn(driverToken, "Customer A", "Product A");
		startReview(adminToken, returnId).andExpect(status().isOk());

		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.inReview").value(1))
				.andExpect(jsonPath("$.waitingWarehouse").value(0));
	}

	@Test
	void dashboardClosedTodayReflectsRealClosuresWithinTheSydneyOperationalDay() throws Exception {
		String returnIdToday = createReturn(driverToken, "Customer Today", "Product Today");
		startReview(adminToken, returnIdToday).andExpect(status().isOk());
		closeReturn(adminToken, returnIdToday, Map.of()).andExpect(status().isOk());

		String returnIdYesterday = createReturn(driverToken, "Customer Yesterday", "Product Yesterday");
		startReview(adminToken, returnIdYesterday).andExpect(status().isOk());
		closeReturn(adminToken, returnIdYesterday, Map.of()).andExpect(status().isOk());
		backdateClosedAt(returnIdYesterday, Instant.now().minus(2, ChronoUnit.DAYS));

		mockMvc.perform(get("/api/v1/admin/dashboard/summary").header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(jsonPath("$.closedToday").value(1));
	}

	// --- List: closedFrom/closedTo filter (Phase 7B) ---

	@Test
	void closedDateRangeFilterMatchesTheSameSemanticSetAsTheClosedTodayCount() throws Exception {
		// The exact case the Closed Today card's click-through must get right:
		// created on an earlier day, but closed today — included by
		// closedFrom/closedTo, not by any createdAt-based filter.
		String returnId = createReturn(driverToken, "Customer Old Create New Close", "Product A");
		backdateCreatedAt(returnId, Instant.now().minus(5, ChronoUnit.DAYS));
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of()).andExpect(status().isOk());

		String returnIdClosedYesterday = createReturn(driverToken, "Customer Closed Yesterday", "Product B");
		startReview(adminToken, returnIdClosedYesterday).andExpect(status().isOk());
		closeReturn(adminToken, returnIdClosedYesterday, Map.of()).andExpect(status().isOk());
		backdateClosedAt(returnIdClosedYesterday, Instant.now().minus(2, ChronoUnit.DAYS));

		String today = java.time.LocalDate.now(java.time.ZoneId.of("Australia/Sydney")).toString();
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("status", "CLOSED").param("closedFrom", today).param("closedTo", today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].id").value(returnId));
	}

	@Test
	void closedDateRangeFilterExcludesAReturnNeverClosed() throws Exception {
		createReturn(driverToken, "Customer Never Closed", "Product A");

		String today = java.time.LocalDate.now(java.time.ZoneId.of("Australia/Sydney")).toString();
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("closedFrom", today).param("closedTo", today))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0));
	}

	@Test
	void closedFromAfterClosedToIsRejected() throws Exception {
		mockMvc.perform(get("/api/v1/admin/returns").header(HttpHeaders.AUTHORIZATION, adminToken)
						.param("closedFrom", "2026-08-10").param("closedTo", "2026-08-01"))
				.andExpect(status().isBadRequest());
	}

	// --- helpers ---

	private void backdateCreatedAt(String returnId, Instant instant) {
		jdbcTemplate.update("UPDATE return_record SET created_at = ? WHERE id = ?", java.sql.Timestamp.from(instant), UUID.fromString(returnId));
	}

	private org.springframework.test.web.servlet.ResultActions startReview(String token, String returnId) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/start-review").header(HttpHeaders.AUTHORIZATION, token));
	}

	private org.springframework.test.web.servlet.ResultActions releaseReview(String token, String returnId) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/release-review").header(HttpHeaders.AUTHORIZATION, token));
	}

	private org.springframework.test.web.servlet.ResultActions takeOver(String token, String returnId, UUID expectedCurrentReviewerId) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/take-over-review")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("expectedCurrentReviewerId", expectedCurrentReviewerId.toString()))));
	}

	private org.springframework.test.web.servlet.ResultActions closeReturn(String token, String returnId, Map<String, Object> overrides) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("sellable", true);
		body.put("creditCustomer", false);
		body.put("chargeCustomer", false);
		body.put("chargeDriver", false);
		body.put("warehouseObservation", "All good");
		body.put("warehouseRepresentativeName", "Warehouse Rep");
		body.put("warehouseSignatureStrokes", List.of(List.of(
				Map.of("x", 0.10, "y", 0.50), Map.of("x", 0.20, "y", 0.40), Map.of("x", 0.35, "y", 0.55), Map.of("x", 0.50, "y", 0.35))));
		body.putAll(overrides);
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/close")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	private org.springframework.test.web.servlet.ResultActions cancelReturn(String token, String returnId, String reason) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/cancel")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("reason", reason))));
	}

	private org.springframework.test.web.servlet.ResultActions signCustomer(String token, String returnId) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("signerName", "Jane Doe");
		body.put("strokes", List.of(List.of(
				Map.of("x", 0.10, "y", 0.50), Map.of("x", 0.20, "y", 0.40), Map.of("x", 0.35, "y", 0.55), Map.of("x", 0.50, "y", 0.35))));
		return mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

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

	private void backdateClosedAt(String returnId, Instant instant) {
		jdbcTemplate.update("UPDATE return_record SET closed_at = ? WHERE id = ?", java.sql.Timestamp.from(instant), UUID.fromString(returnId));
	}

	/** Creates a new ADMIN in the shared test tenant, returning the email so the caller can look up the ID or log in. */
	private String createAdmin(String fullName) {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, fullName, email, email, passwordEncoder.encode(PASSWORD), true));
		return email;
	}

	private String loginNewTenantAdmin() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-review-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String email = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", email, email, passwordEncoder.encode(PASSWORD), true));
		return login(email);
	}

	private String createReturn(String token, String customerName, String productName) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("customerName", customerName);
		body.put("productName", productName);
		body.put("reason", "DAMAGED");
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
