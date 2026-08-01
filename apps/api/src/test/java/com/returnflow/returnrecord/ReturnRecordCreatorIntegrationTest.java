package com.returnflow.returnrecord;

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
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReturnRecordCreatorIntegrationTest {

	private static final String PASSWORD_HASH = "irrelevant-hash";

	@Autowired
	private ReturnRecordCreator returnRecordCreator;

	@Autowired
	private ReturnRecordRepository returnRecordRepository;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private RouteRepository routeRepository;

	@Autowired
	private ReturnNumberGenerator returnNumberGenerator;

	private Tenant tenant;
	private Route activeRoute;
	private User activeDriver;

	@BeforeEach
	void setUp() {
		tenant = tenantRepository.save(new Tenant("Tenant", "return-record-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		activeRoute = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));
		activeDriver = saveDriver(tenant.getId(), true, activeRoute.getId());
	}

	// --- Valid creation ---

	@Test
	void activeDriverWithAnActiveRouteCreatesAReturn() {
		ReturnRecord returnRecord = returnRecordCreator.create(tenant, activeDriver, "  Market ABC  ",
				ReturnReason.DAMAGED_PRODUCT, "  The box was already open  ");

		assertThat(returnRecord.getId()).isNotNull();
		assertThat(returnRecord.getTenant().getId()).isEqualTo(tenant.getId());
		assertThat(returnRecord.getDriver().getId()).isEqualTo(activeDriver.getId());
		assertThat(returnRecord.getRoute().getId()).isEqualTo(activeRoute.getId());
		assertThat(returnRecord.getCustomerName()).isEqualTo("Market ABC");
		assertThat(returnRecord.getObservation()).isEqualTo("The box was already open");
		assertThat(returnRecord.getReason()).isEqualTo(ReturnReason.DAMAGED_PRODUCT);
		assertThat(returnRecord.getStatus()).isEqualTo(ReturnStatus.AWAITING_WAREHOUSE);
		assertThat(returnRecord.getReturnNumber()).matches("RF-\\d{6,}");
		assertThat(returnRecord.getCreatedAt()).isNotNull();
		assertThat(returnRecord.getUpdatedAt()).isNotNull();
	}

	// --- Business-rule rejection ---

	@Test
	void anAdminCannotBeUsedAsTheDriver() {
		String email = uniqueEmail();
		User admin = userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Admin", email, email, PASSWORD_HASH, true));

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, admin, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(DriverRequiredException.class);
	}

	@Test
	void anInactiveDriverIsRejected() {
		User inactiveDriver = saveDriver(tenant.getId(), false, activeRoute.getId());

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, inactiveDriver, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(InactiveDriverException.class);
	}

	@Test
	void aDriverWithoutARouteIsRejected() {
		User driverWithoutRoute = saveDriver(tenant.getId(), true, null);

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, driverWithoutRoute, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(DriverWithoutRouteException.class);
	}

	@Test
	void anInactiveRouteIsRejected() {
		Route inactiveRoute = routeRepository.save(new Route(tenant.getId(), "INACT", "Inactive", false));
		User driverOnInactiveRoute = saveDriver(tenant.getId(), true, inactiveRoute.getId());

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, driverOnInactiveRoute, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(InactiveRouteException.class);
	}

	@Test
	void aDriverFromAnotherTenantIsRejected() {
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "return-record-other-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherRoute = routeRepository.save(new Route(otherTenant.getId(), "OR", "Other Route", true));
		User otherTenantDriver = saveDriver(otherTenant.getId(), true, otherRoute.getId());

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, otherTenantDriver, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(DriverTenantMismatchException.class);
	}

	@Test
	void aRouteBelongingToAnotherTenantIsRejected() {
		// A data-integrity anomaly Phase 2C's own invariants should already
		// prevent (a DRIVER's assigned route always matches the driver's own
		// tenant) — defended here regardless, since the route always comes from
		// the driver's raw routeId, never a caller-supplied parameter.
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "return-record-other2-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		Route otherTenantsRoute = routeRepository.save(new Route(otherTenant.getId(), "OR2", "Other Route", true));
		User driverWithCrossTenantRoute = saveDriver(tenant.getId(), true, otherTenantsRoute.getId());

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, driverWithCrossTenantRoute, "Customer", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(RouteTenantMismatchException.class);
	}

	@Test
	void aBlankCustomerNameIsRejected() {
		assertThatThrownBy(() -> returnRecordCreator.create(tenant, activeDriver, "   ", ReturnReason.OTHER, "Observation"))
				.isInstanceOf(InvalidCustomerNameException.class);
	}

	@Test
	void aTooLongCustomerNameIsRejected() {
		String tooLong = "A".repeat(201);

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, activeDriver, tooLong, ReturnReason.OTHER, "Observation"))
				.isInstanceOf(InvalidCustomerNameException.class);
	}

	@Test
	void aBlankObservationIsRejected() {
		assertThatThrownBy(() -> returnRecordCreator.create(tenant, activeDriver, "Customer", ReturnReason.OTHER, "   "))
				.isInstanceOf(InvalidObservationException.class);
	}

	@Test
	void aTooLongObservationIsRejected() {
		String tooLong = "A".repeat(2001);

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, activeDriver, "Customer", ReturnReason.OTHER, tooLong))
				.isInstanceOf(InvalidObservationException.class);
	}

	@Test
	void aNullReasonIsRejectedBeforeNumberGenerationOrPersistence() {
		long countBefore = returnRecordRepository.count();
		long numberBefore = numericSuffix(returnNumberGenerator.next());

		assertThatThrownBy(() -> returnRecordCreator.create(tenant, activeDriver, "Customer", null, "Observation"))
				.isInstanceOf(InvalidReasonException.class);

		assertThat(returnRecordRepository.count()).isEqualTo(countBefore);
		// The rejected attempt never called the generator, so the very next
		// number issued is still exactly one more than the baseline above —
		// proving no number was consumed, without asserting any absolute
		// sequence value (which would be fragile given the suite's shared,
		// cached Testcontainers Postgres — see ReturnNumberGeneratorTest).
		long numberAfter = numericSuffix(returnNumberGenerator.next());
		assertThat(numberAfter).isEqualTo(numberBefore + 1);
	}

	// --- Historical route behavior ---

	@Test
	void theReturnKeepsReferencingTheRouteActiveAtCreationTimeAfterTheDriverIsReassigned() {
		ReturnRecord created = returnRecordCreator.create(tenant, activeDriver, "Customer", ReturnReason.OTHER, "Observation");

		Route newRoute = routeRepository.save(new Route(tenant.getId(), "R2", "Route Two", true));
		User reassigned = userRepository.findById(activeDriver.getId()).orElseThrow();
		reassigned.update(reassigned.getFullName(), reassigned.getEmail(), reassigned.getNormalizedEmail(), reassigned.getRole(),
				newRoute.getId(), reassigned.isActive());
		userRepository.save(reassigned);

		ReturnRecord reloaded = returnRecordRepository.findById(created.getId()).orElseThrow();
		assertThat(reloaded.getRoute().getId()).isEqualTo(activeRoute.getId());
	}

	// --- Tenant isolation ---

	@Test
	void tenantScopedIdLookupCannotRetrieveAnotherTenantsReturn() {
		ReturnRecord created = returnRecordCreator.create(tenant, activeDriver, "Customer", ReturnReason.OTHER, "Observation");
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "return-record-iso-" + UUID.randomUUID(), TenantStatus.ACTIVE));

		assertThat(returnRecordRepository.findByIdAndTenantId(created.getId(), otherTenant.getId())).isEmpty();
		assertThat(returnRecordRepository.findByIdAndTenantId(created.getId(), tenant.getId())).isPresent();
	}

	@Test
	void tenantScopedReturnNumberLookupCannotRetrieveAnotherTenantsReturn() {
		ReturnRecord created = returnRecordCreator.create(tenant, activeDriver, "Customer", ReturnReason.OTHER, "Observation");
		Tenant otherTenant = tenantRepository.save(new Tenant("Other", "return-record-iso2-" + UUID.randomUUID(), TenantStatus.ACTIVE));

		assertThat(returnRecordRepository.findByReturnNumberAndTenantId(created.getReturnNumber(), otherTenant.getId())).isEmpty();
		assertThat(returnRecordRepository.findByReturnNumberAndTenantId(created.getReturnNumber(), tenant.getId())).isPresent();
	}

	// --- helpers ---

	private User saveDriver(UUID tenantId, boolean active, UUID routeId) {
		String email = uniqueEmail();
		return userRepository.save(new User(tenantId, UserRole.DRIVER, "Driver", email, email, PASSWORD_HASH, active, routeId));
	}

	private String uniqueEmail() {
		return "user-" + UUID.randomUUID() + "@warehouse.example";
	}

	private static long numericSuffix(String returnNumber) {
		return Long.parseLong(returnNumber.substring("RF-".length()));
	}
}
