package com.returnflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

import com.returnflow.auth.AuthSecurityProperties;
import com.returnflow.user.BootstrapAdminProperties;

/**
 * {@code UserDetailsServiceAutoConfiguration} is excluded: this API never
 * uses Spring Security's {@code UserDetailsService}/{@code AuthenticationManager}
 * model (see {@code auth.security.JwtAuthenticationFilter} — authentication
 * is entirely bearer-token-based). Left enabled, it silently registers an
 * unused in-memory user with a random generated password logged at every
 * startup, which is meaningless noise, not a real authentication path.
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableConfigurationProperties({ AuthSecurityProperties.class, BootstrapAdminProperties.class })
public class ReturnFlowApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(ReturnFlowApiApplication.class, args);
	}

}
