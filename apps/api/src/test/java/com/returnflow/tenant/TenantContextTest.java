package com.returnflow.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TenantContextTest {

	@AfterEach
	void clear() {
		TenantContext.clear();
	}

	@Test
	void setAndGetReturnTheSameTenant() {
		Tenant tenant = new Tenant("Warehouse", "warehouse", TenantStatus.ACTIVE);

		TenantContext.set(tenant);

		assertThat(TenantContext.get()).isSameAs(tenant);
	}

	@Test
	void clearRemovesTheStoredTenant() {
		TenantContext.set(new Tenant("Warehouse", "warehouse", TenantStatus.ACTIVE));

		TenantContext.clear();

		assertThat(TenantContext.get()).isNull();
	}

	@Test
	void tenantIsIsolatedPerThread() throws InterruptedException {
		TenantContext.set(new Tenant("Warehouse", "warehouse", TenantStatus.ACTIVE));

		Tenant[] seenOnOtherThread = new Tenant[1];
		Thread other = new Thread(() -> seenOnOtherThread[0] = TenantContext.get());
		other.start();
		other.join();

		assertThat(seenOnOtherThread[0]).isNull();
		assertThat(TenantContext.get()).isNotNull();
	}
}
