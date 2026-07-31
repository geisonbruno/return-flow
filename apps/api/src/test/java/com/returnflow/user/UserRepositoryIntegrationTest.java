package com.returnflow.user;

import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class UserRepositoryIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private TenantRepository tenantRepository;

	@Test
	void findByNormalizedEmailReturnsTheMatchingUser() {
		UUID tenantId = persistTenant();
		String email = "driver-" + UUID.randomUUID() + "@warehouse.example";
		userRepository.save(new User(tenantId, UserRole.DRIVER, "Driver One", email, email, "hashed", true));

		assertThat(userRepository.findByNormalizedEmail(email)).isPresent();
		assertThat(userRepository.findByNormalizedEmail("unknown-" + UUID.randomUUID() + "@warehouse.example")).isEmpty();
	}

	@Test
	void normalizedEmailUniquenessIsEnforced() {
		UUID tenantId = persistTenant();
		String duplicateEmail = "duplicate-" + UUID.randomUUID() + "@warehouse.example";
		userRepository.save(new User(tenantId, UserRole.DRIVER, "First", duplicateEmail, duplicateEmail, "hashed", true));

		assertThatThrownBy(() -> userRepository.saveAndFlush(new User(tenantId, UserRole.DRIVER, "Second",
				"second-" + UUID.randomUUID() + "@warehouse.example", duplicateEmail, "hashed", true)))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private UUID persistTenant() {
		return tenantRepository.save(new Tenant("Tenant", "user-repo-test-" + UUID.randomUUID(), TenantStatus.ACTIVE)).getId();
	}
}
