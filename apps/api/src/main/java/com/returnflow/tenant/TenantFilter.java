package com.returnflow.tenant;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the current tenant for every request and makes it available via
 * {@link TenantContext} for the duration of that request. The context is
 * always cleared afterward, including when the downstream chain throws.
 *
 * <p>Registered explicitly via {@link TenantFilterConfig} rather than
 * {@code @Component}: a plain component-scanned {@code Filter} bean gets
 * auto-included by narrow {@code @WebMvcTest} slices elsewhere in the app,
 * pulling in this filter's database-backed {@link TenantResolver} dependency
 * where no database is configured.
 */
class TenantFilter extends OncePerRequestFilter {

	private final TenantResolver tenantResolver;

	TenantFilter(TenantResolver tenantResolver) {
		this.tenantResolver = tenantResolver;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		try {
			TenantContext.set(tenantResolver.resolve());
			filterChain.doFilter(request, response);
		} finally {
			TenantContext.clear();
		}
	}
}
