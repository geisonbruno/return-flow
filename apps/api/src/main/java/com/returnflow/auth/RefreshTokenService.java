package com.returnflow.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;

/**
 * Issues, looks up, and revokes opaque refresh tokens. The raw token is a
 * 256-bit {@link SecureRandom} value, Base64url-encoded, returned to the
 * caller exactly once. Only a SHA-256 hex digest of it is ever persisted
 * ({@link RefreshTokenSession#getTokenHash()}).
 *
 * <p>A deterministic digest (not a per-row-salted algorithm like BCrypt) is
 * used deliberately: the raw value is already a high-entropy cryptographic
 * random value, not a low-entropy human password, so it needs no salt or
 * deliberately-slow key-derivation to resist guessing — and a deterministic
 * digest is what makes an O(1) unique-index lookup by hash possible at all,
 * which rotation and revocation depend on. {@link MessageDigest} is a
 * standard JDK primitive, not a hand-rolled algorithm.
 */
@Service
public class RefreshTokenService {

	private static final int TOKEN_BYTES = 32;

	private final RefreshTokenRepository repository;
	private final Duration ttl;
	private final Clock clock;
	private final SecureRandom random = new SecureRandom();

	public RefreshTokenService(RefreshTokenRepository repository, AuthSecurityProperties properties, Clock clock) {
		this.repository = repository;
		this.ttl = properties.refreshToken().ttl();
		this.clock = clock;
	}

	record IssuedRefreshToken(String rawToken, Instant expiresAt) {
	}

	IssuedRefreshToken issue(UUID userId) {
		byte[] bytes = new byte[TOKEN_BYTES];
		random.nextBytes(bytes);
		String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		Instant expiresAt = clock.instant().plus(ttl);
		repository.save(new RefreshTokenSession(userId, hash(rawToken), expiresAt));
		return new IssuedRefreshToken(rawToken, expiresAt);
	}

	Optional<RefreshTokenSession> findActiveSession(String rawToken) {
		return repository.findByTokenHash(hash(rawToken)).filter(session -> session.isActive(clock.instant()));
	}

	void revoke(RefreshTokenSession session) {
		session.revoke(clock.instant());
		repository.save(session);
	}

	void revokeIfPresent(String rawToken) {
		repository.findByTokenHash(hash(rawToken)).ifPresent(this::revoke);
	}

	/**
	 * Used by the admin password-reset flow ({@code user.UserAdminService}):
	 * an ADMIN-issued password reset invalidates every existing session for
	 * that user, not just one token the caller happens to know.
	 */
	public void revokeAllForUser(UUID userId) {
		Instant now = clock.instant();
		List<RefreshTokenSession> sessions = repository.findByUserId(userId);
		sessions.forEach(session -> session.revoke(now));
		repository.saveAll(sessions);
	}

	private static String hash(String rawToken) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] out = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(out);
		} catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 is required and always available on a standard JVM.", ex);
		}
	}
}
