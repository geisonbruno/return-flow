package com.returnflow.auth;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import com.returnflow.user.UserRole;

import static org.assertj.core.api.Assertions.assertThat;

class AccessTokenServiceTest {

	private static final String SECRET = "unit-test-only-signing-secret-at-least-32-bytes-long!!";

	private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
			UUID.randomUUID(), UUID.randomUUID(), UserRole.ADMIN, "admin@warehouse.example");

	@Test
	void issuedTokenValidatesBackToTheOriginalPrincipal() {
		AccessTokenService service = serviceWithClock(Clock.systemUTC());

		String token = service.issue(principal).token();

		assertThat(service.validate(token)).contains(principal);
	}

	@Test
	void expiredTokenFailsValidation() {
		Clock farInThePast = Clock.fixed(Instant.parse("2000-01-01T00:00:00Z"), ZoneOffset.UTC);
		AccessTokenService service = serviceWithClock(farInThePast);

		String token = service.issue(principal).token();

		assertThat(service.validate(token)).isEmpty();
	}

	@Test
	void tamperedTokenFailsValidation() {
		AccessTokenService service = serviceWithClock(Clock.systemUTC());
		String token = service.issue(principal).token();
		String tampered = tamperSignature(token);

		assertThat(tampered).isNotEqualTo(token);
		assertThat(service.validate(tampered)).isEmpty();
	}

	@Test
	void malformedTokenFailsValidation() {
		AccessTokenService service = serviceWithClock(Clock.systemUTC());

		assertThat(service.validate("not-a-jwt")).isEmpty();
	}

	@Test
	void tokenSignedWithADifferentSecretFailsValidation() {
		AccessTokenService issuer = serviceWithClock(Clock.systemUTC());
		AccessTokenService validator = new AccessTokenService(
				new AuthSecurityProperties(
						new AuthSecurityProperties.AccessToken("a-completely-different-signing-secret-32-bytes!", Duration.ofMinutes(15)),
						new AuthSecurityProperties.RefreshToken(Duration.ofDays(30))),
				Clock.systemUTC());

		String token = issuer.issue(principal).token();

		assertThat(validator.validate(token)).isEmpty();
	}

	// --- Mandatory-claim validation (validly signed, but missing/malformed
	// claims — JJWT's signature check alone doesn't guard against this, since
	// nothing at the JWT layer prevents a validly-signed token from omitting
	// a claim in principle) ---

	@Test
	void missingTenantClaimFailsValidation() {
		String token = tokenMissingClaim("tenantId");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	@Test
	void missingRoleClaimFailsValidation() {
		String token = tokenMissingClaim("role");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	@Test
	void missingSubjectClaimFailsValidation() {
		String token = tokenMissingClaim("sub");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	@Test
	void malformedSubjectClaimFailsValidation() {
		String token = tokenWithClaim("sub", "not-a-uuid");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	@Test
	void malformedTenantIdClaimFailsValidation() {
		String token = tokenWithClaim("tenantId", "not-a-uuid");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	@Test
	void invalidRoleClaimFailsValidation() {
		String token = tokenWithClaim("role", "SUPERADMIN");

		assertThat(serviceWithClock(Clock.systemUTC()).validate(token)).isEmpty();
	}

	/**
	 * Flips one Base64URL character in the middle of the signature segment —
	 * deliberately not the token's final character. An unpadded Base64URL
	 * trailing character can carry unused padding bits that don't affect the
	 * decoded byte value for some encoded lengths, which made the previous
	 * last-character mutation an occasional no-op (the "tampered" token
	 * still decoded to the exact same signature bytes and validated
	 * successfully). A middle-of-segment character fully contributes to the
	 * decoded bytes, so this always changes the actual signature.
	 */
	private static String tamperSignature(String token) {
		String[] segments = token.split("\\.");
		if (segments.length != 3) {
			throw new IllegalArgumentException("Expected a three-segment JWT, got: " + token);
		}
		String signature = segments[2];
		int index = signature.length() / 2;
		char original = signature.charAt(index);
		char replacement = original == 'A' ? 'B' : 'A';
		String tamperedSignature = signature.substring(0, index) + replacement + signature.substring(index + 1);
		return segments[0] + "." + segments[1] + "." + tamperedSignature;
	}

	private static AccessTokenService serviceWithClock(Clock clock) {
		return new AccessTokenService(
				new AuthSecurityProperties(
						new AuthSecurityProperties.AccessToken(SECRET, Duration.ofMinutes(15)),
						new AuthSecurityProperties.RefreshToken(Duration.ofDays(30))),
				clock);
	}

	/** Builds a validly-signed token with one claim removed from an otherwise-valid claim set. */
	private static String tokenMissingClaim(String claimName) {
		Map<String, Object> claims = validClaims();
		claims.remove(claimName);
		return signedToken(claims);
	}

	/** Builds a validly-signed token with one claim replaced by an arbitrary value. */
	private static String tokenWithClaim(String claimName, Object value) {
		Map<String, Object> claims = validClaims();
		claims.put(claimName, value);
		return signedToken(claims);
	}

	private static Map<String, Object> validClaims() {
		Instant now = Instant.now();
		Map<String, Object> claims = new LinkedHashMap<>();
		claims.put("sub", UUID.randomUUID().toString());
		claims.put("tenantId", UUID.randomUUID().toString());
		claims.put("role", "ADMIN");
		claims.put("email", "admin@warehouse.example");
		claims.put("iat", Date.from(now));
		claims.put("exp", Date.from(now.plus(Duration.ofMinutes(15))));
		return claims;
	}

	private static String signedToken(Map<String, Object> claims) {
		SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
		return Jwts.builder().claims(claims).signWith(key, Jwts.SIG.HS256).compact();
	}
}
