package com.returnflow.returnrecord;

import java.nio.file.Path;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ReturnSignatureIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";

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

	private Tenant tenant;
	private Route route;
	private String driverToken;
	private String adminToken;
	private String returnId;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "driver-sig-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);

		returnId = createReturn(driverToken);
	}

	// --- Create: success ---

	@Test
	void driverSignsTheirOwnReturnAndReceivesSafeMetadata() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.signerName").value("John Smith"))
				.andExpect(jsonPath("$.contentType").value("image/svg+xml"))
				.andExpect(jsonPath("$.sizeBytes").isNumber())
				.andExpect(jsonPath("$.contentPath").value("/api/v1/driver/returns/" + returnId + "/signature/content"))
				.andExpect(jsonPath("$.signedAt").exists())
				.andExpect(jsonPath("$.storageKey").doesNotExist())
				.andExpect(jsonPath("$.tenantId").doesNotExist())
				.andExpect(jsonPath("$.driverId").doesNotExist())
				.andExpect(jsonPath("$.strokes").doesNotExist())
				.andExpect(jsonPath("$.svg").doesNotExist());
	}

	@Test
	void signerNameIsTrimmedBeforeBeingStored() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "  Jane Doe  ", validStroke()))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.signerName").value("Jane Doe"));
	}

	@Test
	void aSecondSignatureForTheSameReturnIsRejected() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "First Signer", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(signRequest(driverToken, returnId, "Second Signer", validStroke()))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Signature Already Exists"));

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(jsonPath("$.signerName").value("First Signer"));
	}

	// --- Create: signer-name validation ---

	@Test
	void nullSignerNameIsRejected() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, null, validStroke())).andExpect(status().isBadRequest());
	}

	@Test
	void blankSignerNameIsRejected() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "   ", validStroke())).andExpect(status().isBadRequest());
	}

	@Test
	void signerNameOver100CharactersIsRejected() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "A".repeat(101), validStroke())).andExpect(status().isBadRequest());
	}

	// --- Create: stroke validation ---

	@Test
	void missingStrokesAreRejected() throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("signerName", "John Smith");

		mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body)))
				.andExpect(status().isBadRequest());
	}

	@Test
	void emptyStrokesAreRejected() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", List.of()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Signature"));
	}

	@Test
	void aSingleTapIsRejected() throws Exception {
		List<List<Map<String, Double>>> singlePointStroke = List.of(List.of(point(0.5, 0.5)));

		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", singlePointStroke))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Signature"));
	}

	@Test
	void twoCoincidentPointsAreRejectedAsAnEffectivelyBlankStroke() throws Exception {
		List<List<Map<String, Double>>> coincident = List.of(List.of(point(0.5, 0.5), point(0.5, 0.5)));

		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", coincident)).andExpect(status().isBadRequest());
	}

	@Test
	void coordinatesOutsideZeroToOneAreRejected() throws Exception {
		List<List<Map<String, Double>>> outOfRange = List.of(List.of(point(0.1, 0.1), point(1.5, 0.9)));

		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", outOfRange)).andExpect(status().isBadRequest());
	}

	@Test
	void nonFiniteCoordinatesAreRejected() throws Exception {
		String body = """
				{"signerName":"John Smith","strokes":[[{"x":0.1,"y":0.1},{"x":NaN,"y":0.5}]]}""";

		mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
						.header(HttpHeaders.AUTHORIZATION, driverToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void moreThan100StrokesAreRejected() throws Exception {
		List<List<Map<String, Double>>> tooManyStrokes = new ArrayList<>();
		for (int i = 0; i < 101; i++) {
			tooManyStrokes.add(List.of(point(0.1, 0.1), point(0.2, 0.2)));
		}

		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", tooManyStrokes)).andExpect(status().isBadRequest());
	}

	@Test
	void moreThan5000TotalPointsAreRejected() throws Exception {
		List<Map<String, Double>> longStroke = new ArrayList<>();
		for (int i = 0; i < 5001; i++) {
			double t = i / 5001.0;
			longStroke.add(point(t, t));
		}

		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", List.of(longStroke))).andExpect(status().isBadRequest());
	}

	@Test
	void aValidShortSignatureIsAccepted() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());
	}

	// --- Create: authorization and isolation ---

	@Test
	void anAdminCannotUseTheDriverSignatureEndpoint() throws Exception {
		mockMvc.perform(signRequest(adminToken, returnId, "John Smith", validStroke())).andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedSigningReturns401() throws Exception {
		mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(signatureBody("John Smith", validStroke()))))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void anotherDriverSigningSomeoneElsesReturnReceives404() throws Exception {
		String otherDriverToken = createDriverAndLogin("Other Driver", route);

		mockMvc.perform(signRequest(otherDriverToken, returnId, "John Smith", validStroke())).andExpect(status().isNotFound());
	}

	@Test
	void aSameRouteDifferentDriverStillReceives404() throws Exception {
		String sameRouteDriverToken = createDriverAndLogin("Same Route Driver", route);

		mockMvc.perform(signRequest(sameRouteDriverToken, returnId, "John Smith", validStroke())).andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantsDriverSigningReceives404() throws Exception {
		String otherTenantDriverToken = createOtherTenantDriverAndLogin();

		mockMvc.perform(signRequest(otherTenantDriverToken, returnId, "John Smith", validStroke())).andExpect(status().isNotFound());
	}

	// --- Metadata retrieval ---

	@Test
	void pendingSignatureMetadataIsReportedAsNotFound() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.title").value("Signature Not Found"));
	}

	@Test
	void owningDriverCanRetrieveCapturedSignatureMetadata() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.signerName").value("John Smith"));
	}

	@Test
	void anotherDriverCannotRetrieveMetadata() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());
		String otherDriverToken = createDriverAndLogin("Other Driver", route);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, otherDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantCannotRetrieveMetadata() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());
		String otherTenantDriverToken = createOtherTenantDriverAndLogin();

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, otherTenantDriverToken))
				.andExpect(status().isNotFound());
	}

	// --- Content retrieval ---

	@Test
	void owningDriverCanRetrieveTheGeneratedSvgContent() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(header().stringValues(HttpHeaders.CONTENT_TYPE, org.hamcrest.Matchers.contains("image/svg+xml")))
				.andExpect(header().string("X-Content-Type-Options", "nosniff"))
				.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
				.andExpect(result -> assertThat(result.getResponse().getContentAsString()).contains("<svg"));
	}

	@Test
	void pendingSignatureContentIsNotFound() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherDriverRetrievingContentReceives404() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());
		String otherDriverToken = createDriverAndLogin("Other Driver", route);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, otherDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantRetrievingContentReceives404() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());
		String otherTenantDriverToken = createOtherTenantDriverAndLogin();

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature/content").header(HttpHeaders.AUTHORIZATION, otherTenantDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void unauthenticatedContentAccessReturns401() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature/content")).andExpect(status().isUnauthorized());
	}

	// --- Return response integration ---

	@Test
	void createReturnResponseInitiallyContainsNullSignature() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(jsonPath("$.signature").isEmpty());
	}

	@Test
	void listResponseReportsTheCapturedSignature() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(jsonPath("$[0].signature.signerName").value("John Smith"))
				.andExpect(jsonPath("$[0].photos").isArray())
				.andExpect(jsonPath("$[0].productName").value("Widget X200"));
	}

	@Test
	void detailResponseReportsTheCapturedSignature() throws Exception {
		mockMvc.perform(signRequest(driverToken, returnId, "John Smith", validStroke())).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(jsonPath("$.signature.signerName").value("John Smith"))
				.andExpect(jsonPath("$.signature.contentType").value("image/svg+xml"));
	}

	// --- Concurrency ---

	@Test
	void concurrentSigningAttemptsCreateExactlyOneSignature() throws Exception {
		int attempts = 8;
		ExecutorService executor = Executors.newFixedThreadPool(attempts);
		CountDownLatch ready = new CountDownLatch(attempts);
		CountDownLatch start = new CountDownLatch(1);
		List<Callable<Integer>> tasks = new ArrayList<>();
		for (int i = 0; i < attempts; i++) {
			int index = i;
			tasks.add(() -> {
				ready.countDown();
				start.await();
				return mockMvc.perform(signRequest(driverToken, returnId, "Signer " + index, validStroke()))
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

		long created = statuses.stream().filter(status -> status == 201).count();
		long conflicts = statuses.stream().filter(status -> status == 409).count();
		assertThat(created).isEqualTo(1);
		assertThat(conflicts).isEqualTo(attempts - 1);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/signature").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk());
	}

	// --- helpers ---

	private MockHttpServletRequestBuilder signRequest(String token, String returnId, String signerName,
			List<List<Map<String, Double>>> strokes) throws Exception {
		return post("/api/v1/driver/returns/" + returnId + "/signature")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(signatureBody(signerName, strokes)));
	}

	private static Map<String, Object> signatureBody(String signerName, List<List<Map<String, Double>>> strokes) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("signerName", signerName);
		body.put("strokes", strokes);
		return body;
	}

	private static List<List<Map<String, Double>>> validStroke() {
		return List.of(List.of(point(0.10, 0.50), point(0.20, 0.40), point(0.35, 0.55), point(0.50, 0.35)));
	}

	private static Map<String, Double> point(double x, double y) {
		Map<String, Double> point = new LinkedHashMap<>();
		point.put("x", x);
		point.put("y", y);
		return point;
	}

	private String createReturn(String token) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("customerName", "Market ABC");
		body.put("productName", "Widget X200");
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

	private String createDriverAndLogin(String fullName, Route onRoute) throws Exception {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, fullName, email, email,
				passwordEncoder.encode(PASSWORD), true, onRoute.getId()));
		return login(email);
	}

	private String createOtherTenantDriverAndLogin() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "driver-sig-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String email = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Tenant Driver", email, email,
				passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		return login(email);
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
