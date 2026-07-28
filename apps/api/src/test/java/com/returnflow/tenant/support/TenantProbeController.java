package com.returnflow.tenant.support;

import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only fixture (never shipped in main) that reports what
 * {@link TenantContext} holds while a real request is being handled — the
 * only way to observe {@link com.returnflow.tenant.TenantFilter}'s effect
 * from outside the filter itself.
 */
@RestController
@RequestMapping("/test-fixture/tenant")
public class TenantProbeController {

	@GetMapping("/current-slug")
	public String currentSlug() {
		Tenant tenant = TenantContext.get();
		return tenant == null ? null : tenant.getSlug();
	}

	@GetMapping("/boom")
	public void boom() {
		throw new IllegalStateException("boom");
	}
}
