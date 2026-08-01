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
		returnRecordRepository.save(new ReturnRecord(tenant, "RF-DUPTEST", driver, route, "Customer", ReturnReason.OTHER,
				"Observation", ReturnStatus.AWAITING_WAREHOUSE));

		assertThatThrownBy(() -> returnRecordRepository.saveAndFlush(new ReturnRecord(tenant, "RF-DUPTEST", driver, route,
				"Customer 2", ReturnReason.OTHER, "Observation 2", ReturnStatus.AWAITING_WAREHOUSE)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}
}
