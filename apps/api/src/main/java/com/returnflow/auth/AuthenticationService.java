package com.returnflow.auth;

import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AccessTokenService.IssuedAccessToken;
import com.returnflow.auth.RefreshTokenService.IssuedRefreshToken;
import com.returnflow.auth.dto.AuthSessionResponse;
import com.returnflow.auth.dto.AuthenticatedUserResponse;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantRepository;
import com.returnflow.tenant.TenantStatus;
import com.returnflow.user.EmailNormalizer;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;

/**
 * Orchestrates login/refresh/logout/current-user. Everything that decides
 * "is this request allowed" lives here; {@link AuthController} only adapts
 * HTTP to these calls, and {@link AccessTokenService}/{@link RefreshTokenService}
 * only know how to generate and validate tokens, not what to do with them.
 */
@Service
class AuthenticationService {

	private final UserRepository userRepository;
	private final TenantRepository tenantRepository;
	private final PasswordEncoder passwordEncoder;
	private final AccessTokenService accessTokenService;
	private final RefreshTokenService refreshTokenService;

	/**
	 * A real BCrypt hash of a fixed, never-used value, computed once at
	 * startup and compared against for every login where the email doesn't
	 * resolve to a real user. Without this, an unknown/inactive email would
	 * short-circuit before ever calling {@code passwordEncoder.matches},
	 * making that path measurably faster than a known-email-wrong-password
	 * attempt — a timing side-channel that leaks which emails exist even
	 * though every path returns the identical {@link InvalidCredentialsException}.
	 */
	private final String dummyPasswordHash;

	AuthenticationService(UserRepository userRepository, TenantRepository tenantRepository,
			PasswordEncoder passwordEncoder, AccessTokenService accessTokenService,
			RefreshTokenService refreshTokenService) {
		this.userRepository = userRepository;
		this.tenantRepository = tenantRepository;
		this.passwordEncoder = passwordEncoder;
		this.accessTokenService = accessTokenService;
		this.refreshTokenService = refreshTokenService;
		this.dummyPasswordHash = passwordEncoder.encode("returnflow-timing-normalization-placeholder");
	}

	@Transactional
	AuthSessionResponse login(String email, String password) {
		Optional<User> existingUser = userRepository.findByNormalizedEmail(EmailNormalizer.normalize(email));
		String hashToCompare = existingUser.map(User::getPasswordHash).orElse(dummyPasswordHash);
		boolean passwordMatches = passwordEncoder.matches(password, hashToCompare);

		User user = existingUser
				.filter(User::isActive)
				.filter(ignored -> passwordMatches)
				.orElseThrow(InvalidCredentialsException::new);
		Tenant tenant = activeTenantOf(user).orElseThrow(InvalidCredentialsException::new);
		return issueSession(user, tenant);
	}

	@Transactional
	AuthSessionResponse refresh(String rawRefreshToken) {
		RefreshTokenSession session = refreshTokenService.findActiveSession(rawRefreshToken)
				.orElseThrow(InvalidRefreshTokenException::new);
		User user = userRepository.findById(session.getUserId())
				.filter(User::isActive)
				.orElseThrow(InvalidRefreshTokenException::new);
		Tenant tenant = activeTenantOf(user).orElseThrow(InvalidRefreshTokenException::new);
		refreshTokenService.revoke(session);
		return issueSession(user, tenant);
	}

	@Transactional
	void logout(String rawRefreshToken) {
		refreshTokenService.revokeIfPresent(rawRefreshToken);
	}

	AuthenticatedUserResponse currentUser(AuthenticatedPrincipal principal) {
		User user = userRepository.findById(principal.userId())
				.filter(User::isActive)
				.orElseThrow(InactiveUserException::new);
		Tenant tenant = activeTenantOf(user).orElseThrow(InactiveUserException::new);
		return new AuthenticatedUserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getRole(),
				tenant.getId(), tenant.getName());
	}

	private Optional<Tenant> activeTenantOf(User user) {
		return tenantRepository.findById(user.getTenantId()).filter(tenant -> tenant.getStatus() == TenantStatus.ACTIVE);
	}

	private AuthSessionResponse issueSession(User user, Tenant tenant) {
		AuthenticatedPrincipal principal = new AuthenticatedPrincipal(user.getId(), tenant.getId(), user.getRole(),
				user.getNormalizedEmail());
		IssuedAccessToken accessToken = accessTokenService.issue(principal);
		IssuedRefreshToken refreshToken = refreshTokenService.issue(user.getId());
		return new AuthSessionResponse(accessToken.token(), accessToken.expiresAt(), refreshToken.rawToken());
	}
}
