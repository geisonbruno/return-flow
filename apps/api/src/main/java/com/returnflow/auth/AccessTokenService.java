package com.returnflow.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import com.returnflow.user.UserRole;

/**
 * Issues and validates short-lived signed (HS256) access tokens carrying
 * only the claims a protected request needs: user, tenant, role, email.
 *
 * <p>{@link Clock} is only used on the issuing side, to compute {@code iat}/
 * {@code exp} — {@link #validate} never needs one, since JJWT checks the
 * embedded absolute {@code exp} claim against real wall-clock time
 * regardless of what clock issued the token. This is what makes "expired
 * token fails" deterministically testable without {@code Thread.sleep}: a
 * service constructed with a clock fixed in the past issues a token whose
 * {@code exp} is already behind real time.
 */
@Service
public class AccessTokenService {

	private final SecretKey key;
	private final Duration ttl;
	private final Clock clock;

	public AccessTokenService(AuthSecurityProperties properties, Clock clock) {
		this.key = Keys.hmacShaKeyFor(properties.accessToken().secret().getBytes(StandardCharsets.UTF_8));
		this.ttl = properties.accessToken().ttl();
		this.clock = clock;
	}

	record IssuedAccessToken(String token, Instant expiresAt) {
	}

	IssuedAccessToken issue(AuthenticatedPrincipal principal) {
		Instant now = clock.instant();
		Instant expiresAt = now.plus(ttl);
		String token = Jwts.builder()
				.subject(principal.userId().toString())
				.claim("tenantId", principal.tenantId().toString())
				.claim("role", principal.role().name())
				.claim("email", principal.email())
				.issuedAt(Date.from(now))
				.expiration(Date.from(expiresAt))
				.signWith(key, Jwts.SIG.HS256)
				.compact();
		return new IssuedAccessToken(token, expiresAt);
	}

	/**
	 * A validly HS256-signed token still isn't trustworthy on its own — the
	 * mandatory claims ({@code sub}, {@code tenantId}, {@code role}) are
	 * explicitly checked for presence before use, so a token missing one
	 * (which normal {@link #issue} never produces, but nothing at the JWT
	 * layer prevents in principle) fails validation the same clean way as an
	 * expired or tampered one, rather than throwing an unhandled
	 * {@code NullPointerException} out of this method.
	 */
	public Optional<AuthenticatedPrincipal> validate(String token) {
		try {
			Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();

			String subject = claims.getSubject();
			String tenantIdClaim = claims.get("tenantId", String.class);
			String roleClaim = claims.get("role", String.class);
			if (subject == null || tenantIdClaim == null || roleClaim == null) {
				return Optional.empty();
			}

			return Optional.of(new AuthenticatedPrincipal(
					UUID.fromString(subject),
					UUID.fromString(tenantIdClaim),
					UserRole.valueOf(roleClaim),
					claims.get("email", String.class)));
		} catch (JwtException | IllegalArgumentException ex) {
			return Optional.empty();
		}
	}
}
