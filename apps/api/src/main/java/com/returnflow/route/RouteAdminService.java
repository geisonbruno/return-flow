package com.returnflow.route;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.route.dto.CreateRouteRequest;
import com.returnflow.route.dto.RouteResponse;
import com.returnflow.route.dto.UpdateRouteRequest;
import com.returnflow.tenant.TenantContext;
import com.returnflow.user.UserRepository;
import com.returnflow.user.UserRole;

/**
 * Orchestrates ADMIN route management. Tenant scoping comes from
 * {@link TenantContext} — populated by {@code auth.security.JwtAuthenticationFilter}
 * before any {@code /api/v1/admin/**} request reaches this service — never
 * from client-supplied data.
 */
@Service
class RouteAdminService {

	private final RouteRepository routeRepository;
	private final UserRepository userRepository;

	RouteAdminService(RouteRepository routeRepository, UserRepository userRepository) {
		this.routeRepository = routeRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	RouteResponse create(CreateRouteRequest request) {
		UUID tenantId = currentTenantId();
		String code = RouteCodeNormalizer.normalize(request.code());
		if (routeRepository.existsByTenantIdAndCode(tenantId, code)) {
			throw new DuplicateRouteCodeException();
		}
		Route route = routeRepository.save(new Route(tenantId, code, request.name(), true));
		return toResponse(route);
	}

	List<RouteResponse> list() {
		return routeRepository.findByTenantIdOrderByCodeAsc(currentTenantId()).stream().map(RouteAdminService::toResponse).toList();
	}

	RouteResponse get(UUID routeId) {
		return toResponse(findOwnedRoute(routeId));
	}

	@Transactional
	RouteResponse update(UUID routeId, UpdateRouteRequest request) {
		Route route = findOwnedRoute(routeId);
		UUID tenantId = currentTenantId();
		String code = RouteCodeNormalizer.normalize(request.code());
		// @Valid on the controller already rejected a null request.active() with a
		// 400 before this method runs, so unboxing here is safe.
		boolean active = request.active();

		routeRepository.findByTenantIdAndCode(tenantId, code)
				.filter(existing -> !existing.getId().equals(routeId))
				.ifPresent(existing -> {
					throw new DuplicateRouteCodeException();
				});

		if (route.isActive() && !active && userRepository.existsByRouteIdAndActiveTrueAndRole(routeId, UserRole.DRIVER)) {
			throw new RouteInUseException();
		}

		route.update(code, request.name(), active);
		return toResponse(route);
	}

	private Route findOwnedRoute(UUID routeId) {
		return routeRepository.findByIdAndTenantId(routeId, currentTenantId()).orElseThrow(RouteNotFoundException::new);
	}

	private static UUID currentTenantId() {
		return TenantContext.get().getId();
	}

	private static RouteResponse toResponse(Route route) {
		return new RouteResponse(route.getId(), route.getCode(), route.getName(), route.isActive(),
				route.getCreatedAt(), route.getUpdatedAt());
	}
}
