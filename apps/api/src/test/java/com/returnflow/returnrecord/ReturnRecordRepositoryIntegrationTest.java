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
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ReturnRecordRepositoryIntegrationTest {

	@Autowired
	private ReturnRecordRepository returnRecordRepository;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private RouteRepository routeRepository;

	private Tenant tenant;
	private Route route;
	private User driver;

	@BeforeEach
	void setUp() {
		tenant = tenantRepository.save(new Tenant("Tenant", "return-record-repo-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		route = routeRepository.save(new Route(tenant.getId(), "R1", "Route One", true));
		String email = "user-" + UUID.randomUUID() + "@warehouse.example";
		driver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Driver", email, email, "irrelevant-hash",
				true, route.getId()));
	}

	@Test
	void duplicateReturnNumberViolatesTheUniqueConstraint() {
		returnRecordRepository.save(new ReturnRecord(tenant, "RF-DUPTEST", driver, route, "Customer", ReturnReason.DAMAGED,
				null, 1, ReturnUnit.EA, "Observation", ReturnStatus.AWAITING_WAREHOUSE));

		assertThatThrownBy(() -> returnRecordRepository.saveAndFlush(new ReturnRecord(tenant, "RF-DUPTEST", driver, route,
				"Customer 2", ReturnReason.DAMAGED, null, 1, ReturnUnit.EA, "Observation 2", ReturnStatus.AWAITING_WAREHOUSE)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void driverScopedListReturnsOnlyThatDriversReturnsNewestFirst() {
		ReturnRecord older = returnRecordRepository.save(new ReturnRecord(tenant, "RF-DRV1", driver, route, "Customer",
				ReturnReason.DAMAGED, null, 1, ReturnUnit.EA, "Observation", ReturnStatus.AWAITING_WAREHOUSE));
		ReturnRecord newer = returnRecordRepository.save(new ReturnRecord(tenant, "RF-DRV2", driver, route, "Customer",
				ReturnReason.DAMAGED, null, 1, ReturnUnit.EA, "Observation", ReturnStatus.AWAITING_WAREHOUSE));

		String email = "user-" + UUID.randomUUID() + "@warehouse.example";
		User otherDriver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", email, email,
				"irrelevant-hash", true, route.getId()));
		returnRecordRepository.save(new ReturnRecord(tenant, "RF-DRV3", otherDriver, route, "Customer",
				ReturnReason.DAMAGED, null, 1, ReturnUnit.EA, "Observation", ReturnStatus.AWAITING_WAREHOUSE));

		var results = returnRecordRepository.findByTenantIdAndDriverIdOrderByCreatedAtDescIdDesc(tenant.getId(), driver.getId());

		assertThat(results).extracting(ReturnRecord::getId).containsExactlyInAnyOrder(older.getId(), newer.getId());
		assertThat(results).extracting(ReturnRecord::getId).doesNotContain(
				returnRecordRepository.findByReturnNumberAndTenantId("RF-DRV3", tenant.getId()).orElseThrow().getId());
	}

	@Test
	void driverScopedIdLookupCannotRetrieveAnotherDriversReturn() {
		ReturnRecord created = returnRecordRepository.save(new ReturnRecord(tenant, "RF-OWNER", driver, route, "Customer",
				ReturnReason.DAMAGED, null, 1, ReturnUnit.EA, "Observation", ReturnStatus.AWAITING_WAREHOUSE));

		String email = "user-" + UUID.randomUUID() + "@warehouse.example";
		User otherDriver = userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Other Driver", email, email,
				"irrelevant-hash", true, route.getId()));

		assertThat(returnRecordRepository.findByIdAndTenantIdAndDriverId(created.getId(), tenant.getId(), driver.getId()))
				.isPresent();
		assertThat(returnRecordRepository.findByIdAndTenantIdAndDriverId(created.getId(), tenant.getId(), otherDriver.getId()))
				.isEmpty();
	}
}
