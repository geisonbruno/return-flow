package com.returnflow.auth.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

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

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AccessTokenService accessTokenService,
			TenantResolver tenantResolver, RestAuthenticationEntryPoint authenticationEntryPoint,
			RestAccessDeniedHandler accessDeniedHandler) throws Exception {
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

		return http.build();
	}
}
