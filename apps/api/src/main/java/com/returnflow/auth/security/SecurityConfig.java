package com.returnflow.auth.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.returnflow.auth.AccessTokenService;
import com.returnflow.tenant.TenantResolver;

/**
 * Public endpoints are exactly: authentication itself (login/refresh/logout
 * — a client can't have a token yet to prove who it is) and the health/
 * OpenAPI endpoints already public before this phase. {@code /auth/me} only
 * needs "any authenticated user". Since Phase 2C, {@code /api/v1/admin/**}
 * additionally requires the {@code ADMIN} role, and since Phase 3B
 * {@code /api/v1/driver/**} requires the {@code DRIVER} role —
 * {@code JwtAuthenticationFilter} already grants {@code ROLE_<role>} from
 * the validated token, so {@code hasRole(...)} needs no further wiring.
 * Everything else under {@code /api/v1/**} (and anything else) just
 * requires a valid access token.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	/**
	 * One CORS configuration for every environment, differing only in which
	 * origins {@link CorsProperties} carries — local development allows the
	 * Expo Web dev origin, a deployment allows the deployed Web app's origin,
	 * and the code is identical in both.
	 *
	 * <p>Methods are exactly those the browser client actually issues: the
	 * Web app reads with {@code GET}, logs in and performs review actions with
	 * {@code POST}, and edits users and routes with {@code PUT}
	 * ({@code UserAdminController} and {@code RouteAdminController}'s
	 * {@code @PutMapping}s). {@code OPTIONS} is the preflight itself. No
	 * {@code DELETE} or {@code PATCH}: the API exposes neither (V1 has no
	 * delete operation at all — root {@code CLAUDE.md} §9.5), so allowing them
	 * would only widen the surface past anything the product can use.
	 *
	 * <p>{@code allowCredentials} stays {@code false}: authentication is
	 * bearer-token based, never browser cookies, so the browser never needs to
	 * attach credentials to a cross-origin request.
	 */
	private static UrlBasedCorsConfigurationSource corsConfigurationSource(List<String> allowedOrigins) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(allowedOrigins);
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
		configuration.setAllowCredentials(false);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/v1/**", configuration);
		return source;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AccessTokenService accessTokenService,
			TenantResolver tenantResolver, RestAuthenticationEntryPoint authenticationEntryPoint,
			RestAccessDeniedHandler accessDeniedHandler, CorsProperties corsProperties) throws Exception {
		List<String> allowedOrigins = corsProperties.resolveAllowedOrigins();
		http
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers(
								"/api/v1/auth/login",
								"/api/v1/auth/refresh",
								"/api/v1/auth/logout",
								"/actuator/health",
								"/actuator/health/**",
								"/actuator/info",
								"/v3/api-docs",
								"/v3/api-docs/**",
								"/swagger-ui/**",
								"/swagger-ui.html")
						.permitAll()
						.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
						.requestMatchers("/api/v1/driver/**").hasRole("DRIVER")
						.anyRequest().authenticated())
				.exceptionHandling(exceptionHandling -> exceptionHandling
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler))
				.addFilterBefore(new JwtAuthenticationFilter(accessTokenService, tenantResolver),
						UsernamePasswordAuthenticationFilter.class);

		// Registered only when an origin is actually configured, so the default
		// (nothing configured) leaves the chain with no CORS handling at all and
		// every cross-origin browser call is denied. Configured here rather than
		// through a bean Spring Security discovers on its own: Spring MVC's
		// auto-configured `mvcHandlerMappingIntrospector` also implements
		// CorsConfigurationSource, so a discovered-by-type lookup is ambiguous.
		// When configured, Spring Security's CorsFilter runs early enough in the
		// chain that a genuine preflight OPTIONS request is answered directly and
		// never reaches the authorization rules above, so it can't be rejected by
		// them.
		if (!allowedOrigins.isEmpty()) {
			http.cors(cors -> cors.configurationSource(corsConfigurationSource(allowedOrigins)));
		}

		return http.build();
	}
}
