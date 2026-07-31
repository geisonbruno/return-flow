package com.returnflow.user;

import com.returnflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full bootstrap-admin configuration is supplied here via
 * {@code @TestPropertySource} (the same keys {@code BOOTSTRAP_ADMIN_*} bind
 * to), separately from every other test's Spring context, which boots with
 * the blank/disabled defaults from {@code application.properties}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"app.bootstrap.admin.email=Admin@Warehouse.example",
		"app.bootstrap.admin.password=s3cret-bootstrap-password!",
		"app.bootstrap.admin.name=Warehouse Admin"
})
class UserBootstrapIntegrationTest {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private UserBootstrap userBootstrap;

	@Autowired
	private BootstrapAdminProperties bootstrapAdminProperties;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void bootstrapAdminExistsWithCorrectTenantAndRole() {
		User admin = userRepository.findByNormalizedEmail("admin@warehouse.example").orElseThrow();

		assertThat(admin.getRole()).isEqualTo(UserRole.ADMIN);
		assertThat(admin.isActive()).isTrue();
		assertThat(admin.getFullName()).isEqualTo("Warehouse Admin");
	}

	@Test
	void passwordIsStoredHashedNotInPlaintext() {
		User admin = userRepository.findByNormalizedEmail("admin@warehouse.example").orElseThrow();

		assertThat(admin.getPasswordHash()).isNotEqualTo("s3cret-bootstrap-password!");
		assertThat(passwordEncoder.matches("s3cret-bootstrap-password!", admin.getPasswordHash())).isTrue();
	}

	@Test
	void bootstrapIsIdempotent() {
		long countBefore = userRepository.count();

		bootstrapAdminProperties.resolveIfEnabled().ifPresent(userBootstrap::ensureBootstrapAdminExists);
		bootstrapAdminProperties.resolveIfEnabled().ifPresent(userBootstrap::ensureBootstrapAdminExists);

		assertThat(userRepository.count()).isEqualTo(countBefore);
	}
}
