package com.returnflow.auth;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Proves the fix for the login timing side-channel (Phase 2B review finding
 * #1): the adaptive password comparison must run on every invalid-credentials
 * path — unknown email, inactive user, wrong password on an active user — not
 * just when the email happens to resolve to an active user. Skipping it on
 * the first two paths would make them measurably faster than the third even
 * though all three return the identical {@link InvalidCredentialsException}
 * (body-equality is separately covered by
 * {@code AuthControllerIntegrationTest.invalidPasswordAndUnknownEmailProduceTheIdenticalSafeError}).
 *
 * <p>Deliberately avoids wall-clock timing assertions (flaky) in favor of a
 * hand-written recording {@link PasswordEncoder} wrapper — not a mocking
 * framework, consistent with this codebase's established no-mocks
 * convention — registered {@code @Primary} so it observes every call
 * {@link AuthenticationService} makes through the real injected dependency,
 * without needing to touch {@link AuthenticationService} itself.
 */
@SpringBootTest
@Import({ TestcontainersConfiguration.class, AuthenticationServiceTimingSafetyIntegrationTest.Config.class })
class AuthenticationServiceTimingSafetyIntegrationTest {

	private static final String PASSWORD = "correct-horse-battery-staple";

	@Autowired
	private AuthenticationService authenticationService;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private RecordingPasswordEncoder recordingPasswordEncoder;

	private Tenant tenant;

	@BeforeEach
	void setUp() {
		tenant = tenantRepository.save(new Tenant("Tenant", "timing-test-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		recordingPasswordEncoder.reset();
	}

	@Test
	void passwordComparisonRunsForAnUnknownEmail() {
		assertThatThrownBy(() -> authenticationService.login("nobody-" + UUID.randomUUID() + "@warehouse.example", PASSWORD))
				.isInstanceOf(InvalidCredentialsException.class);

		assertThat(recordingPasswordEncoder.matchesCallCount()).isEqualTo(1);
	}

	@Test
	void passwordComparisonRunsForAnInactiveUser() {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Inactive Driver", email, email,
				passwordEncoder.encode(PASSWORD), false));

		assertThatThrownBy(() -> authenticationService.login(email, PASSWORD))
				.isInstanceOf(InvalidCredentialsException.class);

		assertThat(recordingPasswordEncoder.matchesCallCount()).isEqualTo(1);
	}

	@Test
	void passwordComparisonRunsForAWrongPasswordOnAnActiveUser() {
		String email = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Active Admin", email, email,
				passwordEncoder.encode(PASSWORD), true));

		assertThatThrownBy(() -> authenticationService.login(email, "wrong-password"))
				.isInstanceOf(InvalidCredentialsException.class);

		assertThat(recordingPasswordEncoder.matchesCallCount()).isEqualTo(1);
	}

	@Test
	void unknownEmailInactiveUserAndWrongPasswordAllThrowTheIdenticalException() {
		String inactiveEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "Inactive Driver", inactiveEmail, inactiveEmail,
				passwordEncoder.encode(PASSWORD), false));
		String activeEmail = uniqueEmail();
		userRepository.save(new User(tenant.getId(), UserRole.ADMIN, "Active Admin", activeEmail, activeEmail,
				passwordEncoder.encode(PASSWORD), true));

		assertThatThrownBy(() -> authenticationService.login(uniqueEmail(), PASSWORD))
				.isInstanceOf(InvalidCredentialsException.class);
		assertThatThrownBy(() -> authenticationService.login(inactiveEmail, PASSWORD))
				.isInstanceOf(InvalidCredentialsException.class);
		assertThatThrownBy(() -> authenticationService.login(activeEmail, "wrong-password"))
				.isInstanceOf(InvalidCredentialsException.class);
	}

	private static String uniqueEmail() {
		return "user-" + UUID.randomUUID() + "@warehouse.example";
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class Config {
		@Bean
		@Primary
		RecordingPasswordEncoder recordingPasswordEncoder() {
			return new RecordingPasswordEncoder();
		}
	}

	/** Delegates to a real {@link BCryptPasswordEncoder} so login behavior is unaffected; only counts {@code matches} calls. */
	static class RecordingPasswordEncoder implements PasswordEncoder {

		private final PasswordEncoder delegate = new BCryptPasswordEncoder();
		private final AtomicInteger matchesCalls = new AtomicInteger();

		@Override
		public String encode(CharSequence rawPassword) {
			return delegate.encode(rawPassword);
		}

		@Override
		public boolean matches(CharSequence rawPassword, String encodedPassword) {
			matchesCalls.incrementAndGet();
			return delegate.matches(rawPassword, encodedPassword);
		}

		int matchesCallCount() {
			return matchesCalls.get();
		}

		void reset() {
			matchesCalls.set(0);
		}
	}
}
