package com.returnflow.auth.security;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
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
	 * Local-development-only CORS allowance so Expo Web (served at
	 * {@code http://localhost:8081}, a different origin than this API's
	 * {@code http://localhost:8080}) can call the API from a browser during
	 * UX testing. Only registered while the {@code local} profile is active
	 * ({@code app.cors.local-origin} in {@code application-local.properties})
	 * — no other profile defines this bean, so production/other profiles get
	 * no CORS allowance from this class at all. Native iOS/Android requests
	 * never go through a browser and are unaffected either way.
	 * {@code allowCredentials} stays {@code false}: auth is bearer-token
	 * based, never browser cookies.
	 */
	@Bean
	@Profile("local")
	UrlBasedCorsConfigurationSource localCorsConfigurationSource(@Value("${app.cors.local-origin}") String localOrigin) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(List.of(localOrigin));
		configuration.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
		configuration.setAllowCredentials(false);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/v1/**", configuration);
		return source;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, AccessTokenService accessTokenService,
			TenantResolver tenantResolver, RestAuthenticationEntryPoint authenticationEntryPoint,
			RestAccessDeniedHandler accessDeniedHandler,
			// Deliberately the concrete UrlBasedCorsConfigurationSource type, not
			// the broader CorsConfigurationSource interface: Spring MVC's own
			// auto-configured `mvcHandlerMappingIntrospector` bean also
			// implements CorsConfigurationSource, so injecting the interface
			// type here resolves ambiguously (two candidates) the moment any
			// profile registers this bean. The concrete type only ever matches
			// localCorsConfigurationSource() above.
			Optional<UrlBasedCorsConfigurationSource> corsConfigurationSource) throws Exception {
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

		// Only present (as a bean) while the `local` profile is active — see
		// localCorsConfigurationSource() above. When configured here, Spring
		// Security's CorsFilter runs early enough in the chain that a genuine
		// preflight OPTIONS request is answered directly and never reaches the
		// authorization rules above, so it can't be rejected by them.
		corsConfigurationSource.ifPresent(source -> http.cors(cors -> cors.configurationSource(source)));

		return http.build();
	}
}
