package com.returnflow.user;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantDefaults;
import com.returnflow.tenant.TenantRepository;

/**
 * Creates the first Warehouse {@code ADMIN} from {@code BOOTSTRAP_ADMIN_*}
 * environment configuration if present. Disabled when the configuration is
 * entirely absent; fails fast at startup on partial configuration (see
 * {@link BootstrapAdminProperties#resolveIfEnabled()}). Idempotent like
 * {@link com.returnflow.tenant.TenantBootstrap}: a check-then-create guarded
 * by the {@code app_user.normalized_email} unique constraint. Runs after the
 * tenant bootstrap ({@code @Order(2)}), which must have already created the
 * Warehouse tenant this admin is assigned to.
 */
@Component
@Order(2)
class UserBootstrap implements ApplicationRunner {

	private final BootstrapAdminProperties properties;
	private final UserRepository userRepository;
	private final TenantRepository tenantRepository;
	private final PasswordEncoder passwordEncoder;

	UserBootstrap(BootstrapAdminProperties properties, UserRepository userRepository,
			TenantRepository tenantRepository, PasswordEncoder passwordEncoder) {
		this.properties = properties;
		this.userRepository = userRepository;
		this.tenantRepository = tenantRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	public void run(ApplicationArguments args) {
		properties.resolveIfEnabled().ifPresent(this::ensureBootstrapAdminExists);
	}

	@Transactional
	void ensureBootstrapAdminExists(BootstrapAdminProperties enabled) {
		String normalizedEmail = EmailNormalizer.normalize(enabled.email());
		if (userRepository.existsByNormalizedEmail(normalizedEmail)) {
			return;
		}
		Tenant warehouse = tenantRepository.findBySlug(TenantDefaults.WAREHOUSE_SLUG)
				.orElseThrow(() -> new IllegalStateException(
						"Default tenant '" + TenantDefaults.WAREHOUSE_SLUG + "' not found — tenant bootstrap should have created it."));
		userRepository.save(new User(warehouse.getId(), UserRole.ADMIN, enabled.name(), enabled.email(),
				normalizedEmail, passwordEncoder.encode(enabled.password()), true));
	}
}
