package com.returnflow.user;

import java.util.List;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.auth.RefreshTokenService;
import com.returnflow.route.Route;
import com.returnflow.route.RouteNotFoundException;
import com.returnflow.route.RouteRepository;
import com.returnflow.route.dto.RouteSummaryResponse;
import com.returnflow.tenant.TenantContext;
import com.returnflow.user.dto.CreateUserRequest;
import com.returnflow.user.dto.ResetPasswordRequest;
import com.returnflow.user.dto.UpdateUserRequest;
import com.returnflow.user.dto.UserResponse;

/**
 * Orchestrates ADMIN user management. Tenant scoping comes from
 * {@link TenantContext} — populated by {@code auth.security.JwtAuthenticationFilter}
 * before any {@code /api/v1/admin/**} request reaches this service — never
 * from client-supplied data.
 */
@Service
class UserAdminService {

	private final UserRepository userRepository;
	private final RouteRepository routeRepository;
	private final PasswordEncoder passwordEncoder;
	private final RefreshTokenService refreshTokenService;

	UserAdminService(UserRepository userRepository, RouteRepository routeRepository, PasswordEncoder passwordEncoder,
			RefreshTokenService refreshTokenService) {
		this.userRepository = userRepository;
		this.routeRepository = routeRepository;
		this.passwordEncoder = passwordEncoder;
		this.refreshTokenService = refreshTokenService;
	}

	@Transactional
	UserResponse create(CreateUserRequest request) {
		UUID tenantId = currentTenantId();
		String normalizedEmail = EmailNormalizer.normalize(request.email());
		if (userRepository.existsByNormalizedEmail(normalizedEmail)) {
			throw new DuplicateEmailException();
		}
		UUID routeId = validateRouteAssignment(tenantId, request.role(), request.routeId(), true);
		User user = userRepository.save(new User(tenantId, request.role(), request.name(), request.email(),
				normalizedEmail, passwordEncoder.encode(request.password()), true, routeId));
		return toResponse(user);
	}

	List<UserResponse> list() {
		return userRepository.findByTenantIdOrderByFullNameAsc(currentTenantId()).stream().map(this::toResponse).toList();
	}

	UserResponse get(UUID userId) {
		return toResponse(findOwnedUser(userId));
	}

	@Transactional
	UserResponse update(UUID userId, UpdateUserRequest request, AuthenticatedPrincipal principal) {
		User user = findOwnedUser(userId);
		UUID tenantId = currentTenantId();
		// @Valid on the controller already rejected a null request.active() with a
		// 400 before this method runs, so unboxing here is safe.
		boolean active = request.active();

		boolean actingOnSelf = userId.equals(principal.userId());
		if (actingOnSelf && !active) {
			throw new SelfDeactivationException();
		}
		if (actingOnSelf && request.role() != UserRole.ADMIN) {
			throw new SelfRoleChangeException();
		}

		String normalizedEmail = EmailNormalizer.normalize(request.email());
		userRepository.findByNormalizedEmail(normalizedEmail)
				.filter(existing -> !existing.getId().equals(userId))
				.ifPresent(existing -> {
					throw new DuplicateEmailException();
				});

		UUID routeId = validateRouteAssignment(tenantId, request.role(), request.routeId(), active);
		user.update(request.name(), request.email(), normalizedEmail, request.role(), routeId, active);
		return toResponse(user);
	}

	@Transactional
	void resetPassword(UUID userId, ResetPasswordRequest request) {
		User user = findOwnedUser(userId);
		user.changePasswordHash(passwordEncoder.encode(request.newPassword()));
		refreshTokenService.revokeAllForUser(user.getId());
	}

	/**
	 * ADMIN must have no route; DRIVER must have an active, same-tenant route
	 * whenever {@code resultingActive} is {@code true} — an inactive DRIVER
	 * may be left without one. {@code resultingActive} is always {@code true}
	 * for creation (created users are always active) and the request's own
	 * {@code active} field for an update.
	 */
	private UUID validateRouteAssignment(UUID tenantId, UserRole role, UUID requestedRouteId, boolean resultingActive) {
		if (role == UserRole.ADMIN) {
			if (requestedRouteId != null) {
				throw new InvalidRouteAssignmentException("An ADMIN must not have a route.");
			}
			return null;
		}
		if (requestedRouteId == null) {
			if (resultingActive) {
				throw new InvalidRouteAssignmentException("An active DRIVER requires a route.");
			}
			return null;
		}
		Route route = routeRepository.findByIdAndTenantId(requestedRouteId, tenantId).orElseThrow(RouteNotFoundException::new);
		if (!route.isActive()) {
			throw new InvalidRouteAssignmentException("The selected route is not active.");
		}
		return route.getId();
	}

	private User findOwnedUser(UUID userId) {
		return userRepository.findByIdAndTenantId(userId, currentTenantId()).orElseThrow(UserNotFoundException::new);
	}

	private static UUID currentTenantId() {
		return TenantContext.get().getId();
	}

	private UserResponse toResponse(User user) {
		RouteSummaryResponse route = user.getRouteId() == null ? null : routeRepository.findById(user.getRouteId())
				.map(r -> new RouteSummaryResponse(r.getId(), r.getCode(), r.getName(), r.isActive()))
				.orElse(null);
		return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getRole(), user.isActive(),
				route, user.getCreatedAt(), user.getUpdatedAt());
	}
}
