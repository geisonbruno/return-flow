package com.returnflow.tenant;

import com.returnflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The default tenant is created by {@link TenantBootstrap} as soon as the
 * application context starts, so by the time this test runs it already
 * exists — {@link #defaultTenantExistsAfterStartup()} just confirms that.
 * {@link #bootstrapIsIdempotent()} re-invokes the bootstrap logic directly to
 * prove a second run never creates a duplicate.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TenantBootstrapIntegrationTest {

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private TenantBootstrap tenantBootstrap;

	@Test
	void defaultTenantExistsAfterStartup() {
		Tenant warehouse = tenantRepository.findBySlug("warehouse").orElseThrow();

		assertThat(warehouse.getName()).isEqualTo("Warehouse");
		assertThat(warehouse.getStatus()).isEqualTo(TenantStatus.ACTIVE);
	}

	@Test
	void bootstrapIsIdempotent() {
		long countBefore = tenantRepository.count();

		tenantBootstrap.ensureDefaultTenantExists();
		tenantBootstrap.ensureDefaultTenantExists();

		assertThat(tenantRepository.count()).isEqualTo(countBefore);
	}
}
