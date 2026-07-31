package com.returnflow.auth;

import java.time.Instant;
import java.util.UUID;

import com.returnflow.TestcontainersConfiguration;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class RefreshTokenServiceIntegrationTest {

	@Autowired
	private RefreshTokenService refreshTokenService;

	@Autowired
	private RefreshTokenRepository refreshTokenRepository;

	@Autowired
	private TenantRepository tenantRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void issuedTokenIsFoundAsAnActiveSession() {
		UUID userId = persistUser();

		String rawToken = refreshTokenService.issue(userId).rawToken();

		assertThat(refreshTokenService.findActiveSession(rawToken))
				.hasValueSatisfying(session -> assertThat(session.getUserId()).isEqualTo(userId));
	}

	@Test
	void rawTokenIsNeverPersistedOnlyItsHash() {
		String rawToken = refreshTokenService.issue(persistUser()).rawToken();

		RefreshTokenSession session = refreshTokenService.findActiveSession(rawToken).orElseThrow();

		assertThat(session.getTokenHash()).isNotEqualTo(rawToken);
	}

	@Test
	void revokedTokenIsNoLongerAnActiveSession() {
		String rawToken = refreshTokenService.issue(persistUser()).rawToken();
		RefreshTokenSession session = refreshTokenService.findActiveSession(rawToken).orElseThrow();

		refreshTokenService.revoke(session);

		assertThat(refreshTokenService.findActiveSession(rawToken)).isEmpty();
	}

	@Test
	void expiredTokenIsNoLongerAnActiveSession() {
		RefreshTokenSession expired = refreshTokenRepository.save(new RefreshTokenSession(persistUser(),
				"already-expired-hash-" + UUID.randomUUID(), Instant.now().minusSeconds(1)));

		assertThat(refreshTokenRepository.findByTokenHash(expired.getTokenHash()))
				.hasValueSatisfying(session -> assertThat(session.isActive(Instant.now())).isFalse());
	}

	@Test
	void revokeIfPresentIsANoOpWhenTheTokenDoesNotExist() {
		refreshTokenService.revokeIfPresent("a-token-that-was-never-issued");
	}

	private UUID persistUser() {
		Tenant tenant = tenantRepository.save(new Tenant("Tenant", "refresh-token-test-" + UUID.randomUUID(), TenantStatus.ACTIVE));
		String email = "user-" + UUID.randomUUID() + "@warehouse.example";
		return userRepository.save(new User(tenant.getId(), UserRole.DRIVER, "User", email, email,
				passwordEncoder.encode("irrelevant-password"), true)).getId();
	}
}
