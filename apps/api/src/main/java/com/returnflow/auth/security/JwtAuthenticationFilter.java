package com.returnflow.auth.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.returnflow.auth.AccessTokenService;
import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantContext;
import com.returnflow.tenant.TenantNotActiveException;
import com.returnflow.tenant.TenantResolver;

/**
 * The single place in the whole application where a bearer access token
 * turns into both a Spring Security {@code Authentication} and the resolved
 * {@link TenantContext} for the request — replacing Phase 2A's always-run
 * {@code TenantFilter}, which resolved a hardcoded default tenant for every
 * request regardless of identity. That mechanism is retired entirely rather
 * than kept alongside this one: its only purpose no longer applies now that
 * a real authenticated tenant is available, and running both would mean two
 * competing ideas of "the current tenant."
 *
 * <p>Registered via {@link SecurityConfig} with
 * {@code addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)},
 * i.e. as part of the Spring Security filter chain rather than a standalone
 * servlet filter — Phase 2A's filter was deliberately kept out of the
 * Security chain (registered instead via a raw {@code FilterRegistrationBean}
 * on the servlet container) because at that point there was no security
 * chain to speak of and no authenticated principal to derive a tenant from.
 * Now the tenant resolution inherently depends on an authenticated identity,
 * so it has to live inside that chain.
 *
 * <p>On any failure to authenticate (missing header, invalid/expired/
 * tampered token, or a token whose tenant no longer exists/is inactive) this
 * filter does nothing and simply continues the chain unauthenticated —
 * deliberately not throwing — so Spring Security's normal "this endpoint
 * requires authentication" handling (via {@link RestAuthenticationEntryPoint})
 * produces one consistent 401 for every one of those causes, without this
 * filter needing its own HTTP error mapping.
 */
class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final AccessTokenService accessTokenService;
	private final TenantResolver tenantResolver;

	JwtAuthenticationFilter(AccessTokenService accessTokenService, TenantResolver tenantResolver) {
		this.accessTokenService = accessTokenService;
		this.tenantResolver = tenantResolver;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {
		Optional<AuthenticatedPrincipal> principal = extractBearerToken(request).flatMap(accessTokenService::validate);
		if (principal.isEmpty()) {
			filterChain.doFilter(request, response);
			return;
		}

		Tenant tenant;
		try {
			tenant = tenantResolver.resolve(principal.get().tenantId());
		} catch (TenantNotActiveException ex) {
			filterChain.doFilter(request, response);
			return;
		}

		var authentication = new UsernamePasswordAuthenticationToken(
				principal.get(), null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.get().role())));
		SecurityContextHolder.getContext().setAuthentication(authentication);
		TenantContext.set(tenant);
		try {
			filterChain.doFilter(request, response);
		} finally {
			TenantContext.clear();
		}
	}

	private static Optional<String> extractBearerToken(HttpServletRequest request) {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
			return Optional.empty();
		}
		return Optional.of(header.substring(7).trim());
	}
}
