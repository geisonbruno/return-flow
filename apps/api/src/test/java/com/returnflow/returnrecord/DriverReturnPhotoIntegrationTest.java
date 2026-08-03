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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

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
class DriverReturnPhotoIntegrationTest {

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

	private Tenant tenant;
	private Route route;
	private User driver;
	private String driverToken;
	private String adminToken;
	private String returnId;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "driver-photo-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		driver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);

		returnId = createReturn(driverToken);
	}

	// --- Upload: success ---

	@Test
	void driverUploadsAJpegToTheirOwnReturnAndReceivesSafeMetadata() throws Exception {
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(1024)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.contentType").value("image/jpeg"))
				.andExpect(jsonPath("$.sizeBytes").value(1024))
				.andExpect(jsonPath("$.position").value(1))
				.andExpect(jsonPath("$.contentPath")
						.value(org.hamcrest.Matchers.startsWith("/api/v1/driver/returns/" + returnId + "/photos/")))
				.andExpect(jsonPath("$.contentPath").value(org.hamcrest.Matchers.endsWith("/content")))
				.andExpect(jsonPath("$.createdAt").exists())
				.andExpect(jsonPath("$.storageKey").doesNotExist())
				.andExpect(jsonPath("$.tenantId").doesNotExist())
				.andExpect(jsonPath("$.driverId").doesNotExist())
				.andExpect(jsonPath("$.filePath").doesNotExist());
	}

	@Test
	void secondUploadReceivesPositionTwo() throws Exception {
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(512))).andExpect(status().isCreated());

		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(512)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.position").value(2));
	}

	@Test
	void extraUnexpectedFormFieldsCannotOverrideServerDerivedValues() throws Exception {
		MockMultipartHttpServletRequestBuilder request = multipart("/api/v1/driver/returns/" + returnId + "/photos")
				.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", jpegBytes(256)))
				.param("position", "99")
				.param("tenantId", UUID.randomUUID().toString())
				.header(HttpHeaders.AUTHORIZATION, driverToken);

		mockMvc.perform(request)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.position").value(1));
	}

	// --- Upload: field validation ---

	@Test
	void missingFileIsRejected() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isBadRequest());
	}

	@Test
	void emptyFileIsRejected() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]))
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Photo File"));
	}

	@Test
	void unsupportedContentTypeIsRejected() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "photo.png", "image/png", jpegBytes(256)))
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Photo File"));
	}

	@Test
	void aFileWhoseBytesDoNotActuallyLookLikeAJpegIsRejectedDespiteAnHonestContentType() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", "not really a jpeg".getBytes()))
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Photo File"));
	}

	@Test
	void fileLargerThan5MbIsRejected() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "big.jpg", "image/jpeg", jpegBytes(6 * 1024 * 1024)))
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.title").value("Invalid Photo File"));
	}

	@Test
	void aSixthPhotoIsRejected() throws Exception {
		for (int i = 0; i < 5; i++) {
			mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());
		}

		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Photo Limit Exceeded"));

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(jsonPath("$.length()").value(5));
	}

	// --- Upload: authorization and isolation ---

	@Test
	void anAdminCannotUseTheDriverPhotoEndpoint() throws Exception {
		mockMvc.perform(uploadRequest(adminToken, returnId, jpegBytes(100))).andExpect(status().isForbidden());
	}

	@Test
	void unauthenticatedUploadReturns401() throws Exception {
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", jpegBytes(100))))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void anotherDriverUploadingToSomeoneElsesReturnReceives404() throws Exception {
		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		String otherDriverToken = login(otherDriverEmail);

		mockMvc.perform(uploadRequest(otherDriverToken, returnId, jpegBytes(100))).andExpect(status().isNotFound());
	}

	@Test
	void aSameRouteDifferentDriverStillReceives404() throws Exception {
		String sameRouteDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Same Route Driver", sameRouteDriverEmail,
				sameRouteDriverEmail, passwordEncoder.encode(PASSWORD), true, route.getId()));
		String sameRouteDriverToken = login(sameRouteDriverEmail);

		mockMvc.perform(uploadRequest(sameRouteDriverToken, returnId, jpegBytes(100))).andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantsDriverUploadingReceives404() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "driver-photo-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherTenantDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Tenant Driver", otherTenantDriverEmail,
				otherTenantDriverEmail, passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		String otherTenantDriverToken = login(otherTenantDriverEmail);

		mockMvc.perform(uploadRequest(otherTenantDriverToken, returnId, jpegBytes(100))).andExpect(status().isNotFound());
	}

	// --- Listing ---

	@Test
	void photosAreReturnedInPositionOrder() throws Exception {
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				.andExpect(jsonPath("$[0].position").value(1))
				.andExpect(jsonPath("$[1].position").value(2))
				.andExpect(jsonPath("$[2].position").value(3));
	}

	@Test
	void noPhotosReturnsAnEmptyArray() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void anotherDriverCannotListPhotos() throws Exception {
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());

		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		String otherDriverToken = login(otherDriverEmail);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, otherDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantCannotListPhotos() throws Exception {
		mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(100))).andExpect(status().isCreated());

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "driver-photo-list-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherTenantDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Tenant Driver", otherTenantDriverEmail,
				otherTenantDriverEmail, passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		String otherTenantDriverToken = login(otherTenantDriverEmail);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, otherTenantDriverToken))
				.andExpect(status().isNotFound());
	}

	// --- Content ---

	@Test
	void theOwningDriverCanRetrieveTheExactJpegBytesWithASafeContentType() throws Exception {
		byte[] original = jpegBytes(2048);
		MvcResult uploaded = mockMvc.perform(uploadRequest(driverToken, returnId, original))
				.andExpect(status().isCreated())
				.andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos/" + photoId + "/content")
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/jpeg"))
				.andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"return-photo.jpg\""))
				.andExpect(result -> assertThat(result.getResponse().getContentAsByteArray()).isEqualTo(original));
	}

	@Test
	void anotherDriverRetrievingContentReceives404() throws Exception {
		MvcResult uploaded = mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(256)))
				.andExpect(status().isCreated())
				.andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		String otherDriverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", otherDriverEmail, otherDriverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		String otherDriverToken = login(otherDriverEmail);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos/" + photoId + "/content")
						.header(HttpHeaders.AUTHORIZATION, otherDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void anotherTenantRetrievingContentReceives404() throws Exception {
		MvcResult uploaded = mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(256)))
				.andExpect(status().isCreated())
				.andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "driver-photo-content-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		String otherTenantDriverEmail = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.DRIVER, "Other Tenant Driver", otherTenantDriverEmail,
				otherTenantDriverEmail, passwordEncoder.encode(PASSWORD), true, otherRoute.getId()));
		String otherTenantDriverToken = login(otherTenantDriverEmail);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos/" + photoId + "/content")
						.header(HttpHeaders.AUTHORIZATION, otherTenantDriverToken))
				.andExpect(status().isNotFound());
	}

	@Test
	void unauthenticatedContentAccessReturns401() throws Exception {
		MvcResult uploaded = mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(256)))
				.andExpect(status().isCreated())
				.andReturn();
		String photoId = objectMapper.readTree(uploaded.getResponse().getContentAsString()).get("id").asText();

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos/" + photoId + "/content"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void aNonexistentPhotoIdOnAValidReturnIsNotFound() throws Exception {
		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos/" + UUID.randomUUID() + "/content")
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isNotFound());
	}

	// --- Concurrency ---

	@Test
	void concurrentUploadsCannotCreateMoreThanFivePhotosAndPositionsStayUniqueAndInRange() throws Exception {
		int attempts = 8;
		ExecutorService executor = Executors.newFixedThreadPool(attempts);
		CountDownLatch ready = new CountDownLatch(attempts);
		CountDownLatch start = new CountDownLatch(1);
		List<Callable<Integer>> tasks = new ArrayList<>();
		for (int i = 0; i < attempts; i++) {
			tasks.add(() -> {
				ready.countDown();
				start.await();
				return mockMvc.perform(uploadRequest(driverToken, returnId, jpegBytes(64))).andReturn().getResponse().getStatus();
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
		assertThat(created).isEqualTo(5);
		assertThat(conflicts).isEqualTo(attempts - 5);

		mockMvc.perform(get("/api/v1/driver/returns/" + returnId + "/photos").header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(5))
				.andExpect(jsonPath("$[0].position").value(1))
				.andExpect(jsonPath("$[1].position").value(2))
				.andExpect(jsonPath("$[2].position").value(3))
				.andExpect(jsonPath("$[3].position").value(4))
				.andExpect(jsonPath("$[4].position").value(5));
	}

	// --- helpers ---

	private MockMultipartHttpServletRequestBuilder uploadRequest(String token, String returnId, byte[] content) {
		return multipart("/api/v1/driver/returns/" + returnId + "/photos")
				.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", content))
				.header(HttpHeaders.AUTHORIZATION, token);
	}

	private static byte[] jpegBytes(int totalSize) {
		byte[] bytes = new byte[Math.max(totalSize, JPEG_MAGIC.length)];
		System.arraycopy(JPEG_MAGIC, 0, bytes, 0, JPEG_MAGIC.length);
		return bytes;
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
