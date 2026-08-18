package com.returnflow.returnrecord;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
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
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
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
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 9 — the ADMIN administrative PDF: authorization, tenant isolation,
 * closed-only enforcement, response headers, and the trusted content of the
 * generated document (parsed back with PDFBox, never asserted byte-for-byte).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AdminReturnPdfIntegrationTest {

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
	private String driverToken;
	private String adminToken;

	@BeforeEach
	void setUp() throws Exception {
		tenant = tenantRepository.save(new Tenant("Tenant", "admin-pdf-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));

		String driverEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver One", driverEmail, driverEmail,
				passwordEncoder.encode(PASSWORD), true, route.getId()));
		driverToken = login(driverEmail);

		String adminEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin One", adminEmail, adminEmail,
				passwordEncoder.encode(PASSWORD), true));
		adminToken = login(adminEmail);
	}

	// --- authorization and lifecycle ---

	@Test
	void adminCanDownloadThePdfForAClosedReturnInTheirOwnTenant() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget 500ml");

		MvcResult result = requestPdf(adminToken, returnId)
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE))
				.andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
				.andReturn();

		assertThat(result.getResponse().getContentAsByteArray()).startsWith("%PDF".getBytes(StandardCharsets.US_ASCII));
	}

	@Test
	void contentDispositionOffersADownloadNamedAfterTheReturnNumber() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget 500ml");
		String returnNumber = returnNumberOf(returnId);

		requestPdf(adminToken, returnId)
				.andExpect(status().isOk())
				.andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
						"attachment; filename=\"ReturnFlow-" + returnNumber + ".pdf\""));
	}

	@Test
	void anAwaitingWarehouseReturnCannotProduceAPdf() throws Exception {
		String returnId = createReturn(driverToken, "Acme Pty Ltd", "Blue Widget");

		requestPdf(adminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Invalid Return State"))
				.andExpect(jsonPath("$.detail").value("Only a closed return can produce a PDF."));
	}

	@Test
	void anInReviewReturnCannotProduceAPdf() throws Exception {
		String returnId = createReturn(driverToken, "Acme Pty Ltd", "Blue Widget");
		startReview(adminToken, returnId).andExpect(status().isOk());

		requestPdf(adminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Invalid Return State"));
	}

	@Test
	void aCancelledReturnCannotProduceAPdf() throws Exception {
		String returnId = createReturn(driverToken, "Acme Pty Ltd", "Blue Widget");
		cancelReturn(adminToken, returnId, "Duplicate record").andExpect(status().isOk());

		requestPdf(adminToken, returnId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.title").value("Invalid Return State"));
	}

	@Test
	void aDriverCannotDownloadThePdf() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget");

		requestPdf(driverToken, returnId).andExpect(status().isForbidden());
	}

	@Test
	void anAdminFromAnotherTenantGetsNotFoundRatherThanAnyHintTheReturnExists() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget");

		requestPdf(loginNewTenantAdmin(), returnId).andExpect(status().isNotFound());
	}

	@Test
	void anUnknownReturnIsNotFound() throws Exception {
		requestPdf(adminToken, UUID.randomUUID().toString()).andExpect(status().isNotFound());
	}

	// --- generated content ---

	@Test
	void thePdfCarriesTheAuthoritativeReturnDriverRouteAndReasonData() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget 500ml");
		String text = extractText(pdfBytes(returnId));

		assertThat(text).contains("ReturnFlow");
		assertThat(text).contains("Return Record");
		assertThat(text).contains(returnNumberOf(returnId));
		assertThat(text).contains("CLOSED");
		assertThat(text).contains("Acme Pty Ltd");
		assertThat(text).contains("Blue Widget 500ml");
		assertThat(text).contains("1 EA");
		assertThat(text).contains("Damaged");
		assertThat(text).contains("Box was open");
		assertThat(text).contains("Driver One");
		assertThat(text).contains("R1");
		assertThat(text).contains("Route One");
	}

	@Test
	void thePdfCarriesTheWarehouseDecisionsRepresentativesAndTimestamps() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget");
		String text = extractText(pdfBytes(returnId));

		assertThat(text).contains("Sellable");
		assertThat(text).contains("Credit customer");
		assertThat(text).contains("Charge customer");
		assertThat(text).contains("Charge driver");
		assertThat(text).contains("Yes");
		assertThat(text).contains("No");
		assertThat(text).contains("All good");
		assertThat(text).contains("Warehouse Rep");
		assertThat(text).contains("Jane Doe");
		assertThat(text).contains("Admin One");
		assertThat(text).contains("Created at");
		assertThat(text).contains("Review started at");
		assertThat(text).contains("Closed at");
		assertThat(text).contains("AEST");
	}

	@Test
	void bothSignaturesAreRenderedRatherThanReportedMissing() throws Exception {
		String returnId = closedReturn("Acme Pty Ltd", "Blue Widget");
		String text = extractText(pdfBytes(returnId));

		assertThat(text).contains("Customer signature");
		assertThat(text).contains("Warehouse signature");
		assertThat(text).doesNotContain("Not captured.");
	}

	@Test
	void photosAreNeitherEmbeddedNorMentionedEvenWhenTheReturnHasThem() throws Exception {
		String returnId = createReturn(driverToken, "Acme Pty Ltd", "Blue Widget");
		uploadPhoto(returnId);
		uploadPhoto(returnId);
		signCustomer(driverToken, returnId).andExpect(status().isCreated());
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId).andExpect(status().isOk());

		byte[] bytes = pdfBytes(returnId);

		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			for (PDPage page : pdf.getPages()) {
				assertThat(page.getResources().getXObjectNames()).isEmpty();
			}
		}
		assertThat(extractText(bytes)).doesNotContainIgnoringCase("photo");
	}

	@Test
	void aReturnWithMaximumLengthFreeTextStillGeneratesAValidMultiPagePdf() throws Exception {
		String returnId = createReturnWithBody(driverToken, body -> {
			body.put("customerName", "A".repeat(200));
			body.put("productName", "B".repeat(200));
			body.put("reason", "OTHER");
			body.put("reasonDetails", "C".repeat(500));
			body.put("observation", "D".repeat(2000));
		});
		signCustomer(driverToken, returnId).andExpect(status().isCreated());
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId, Map.of("warehouseObservation", "E".repeat(2000))).andExpect(status().isOk());

		byte[] bytes = pdfBytes(returnId);

		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
		}
		assertThat(extractText(bytes)).contains(returnNumberOf(returnId));
	}

	// --- helpers ---

	private byte[] pdfBytes(String returnId) throws Exception {
		return requestPdf(adminToken, returnId).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
	}

	private static String extractText(byte[] bytes) throws IOException {
		try (PDDocument pdf = Loader.loadPDF(bytes)) {
			return new PDFTextStripper().getText(pdf);
		}
	}

	private ResultActions requestPdf(String token, String returnId) throws Exception {
		return mockMvc.perform(get("/api/v1/admin/returns/" + returnId + "/pdf").header(HttpHeaders.AUTHORIZATION, token));
	}

	/** Drives the real driver + warehouse workflow end to end, so the PDF is built from genuinely persisted state. */
	private String closedReturn(String customerName, String productName) throws Exception {
		String returnId = createReturn(driverToken, customerName, productName);
		signCustomer(driverToken, returnId).andExpect(status().isCreated());
		startReview(adminToken, returnId).andExpect(status().isOk());
		closeReturn(adminToken, returnId).andExpect(status().isOk());
		return returnId;
	}

	private String returnNumberOf(String returnId) throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/admin/returns/" + returnId).header(HttpHeaders.AUTHORIZATION, adminToken))
				.andExpect(status().isOk())
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).get("returnNumber").asText();
	}

	private ResultActions startReview(String token, String returnId) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/start-review").header(HttpHeaders.AUTHORIZATION, token));
	}

	private ResultActions cancelReturn(String token, String returnId, String reason) throws Exception {
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/cancel")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("reason", reason))));
	}

	private ResultActions closeReturn(String token, String returnId) throws Exception {
		return closeReturn(token, returnId, Map.of());
	}

	private ResultActions closeReturn(String token, String returnId, Map<String, Object> overrides) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("sellable", true);
		body.put("creditCustomer", false);
		body.put("chargeCustomer", false);
		body.put("chargeDriver", true);
		body.put("warehouseObservation", "All good");
		body.put("warehouseRepresentativeName", "Warehouse Rep");
		body.put("warehouseSignatureStrokes", strokes());
		body.putAll(overrides);
		return mockMvc.perform(post("/api/v1/admin/returns/" + returnId + "/close")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	private ResultActions signCustomer(String token, String returnId) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("signerName", "Jane Doe");
		body.put("strokes", strokes());
		return mockMvc.perform(post("/api/v1/driver/returns/" + returnId + "/signature")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(body)));
	}

	private static List<List<Map<String, Object>>> strokes() {
		return List.of(List.of(
				Map.of("x", 0.10, "y", 0.50), Map.of("x", 0.20, "y", 0.40),
				Map.of("x", 0.35, "y", 0.55), Map.of("x", 0.50, "y", 0.35)));
	}

	private void uploadPhoto(String returnId) throws Exception {
		byte[] content = new byte[64];
		System.arraycopy(JPEG_MAGIC, 0, content, 0, JPEG_MAGIC.length);
		mockMvc.perform(multipart("/api/v1/driver/returns/" + returnId + "/photos")
						.file(new MockMultipartFile("file", "photo.jpg", "image/jpeg", content))
						.header(HttpHeaders.AUTHORIZATION, driverToken))
				.andExpect(status().isCreated());
	}

	private String createReturn(String token, String customerName, String productName) throws Exception {
		return createReturnWithBody(token, body -> {
			body.put("customerName", customerName);
			body.put("productName", productName);
			body.put("reason", "DAMAGED");
			body.put("observation", "Box was open");
		});
	}

	private String createReturnWithBody(String token, java.util.function.Consumer<Map<String, Object>> customizer) throws Exception {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("quantity", 1);
		body.put("unit", "EA");
		customizer.accept(body);

		MvcResult result = mockMvc.perform(post("/api/v1/driver/returns")
						.header(HttpHeaders.AUTHORIZATION, token)
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body)))
				.andExpect(status().isCreated())
				.andReturn();
		return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
	}

	private String loginNewTenantAdmin() throws Exception {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "admin-pdf-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String email = uniqueEmail();
		userRepository.save(new User(otherTenant.getId(), UserRole.ADMIN, "Other Admin", email, email,
				passwordEncoder.encode(PASSWORD), true));
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
