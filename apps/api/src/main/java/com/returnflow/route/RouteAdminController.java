package com.returnflow.route;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.route.dto.CreateRouteRequest;
import com.returnflow.route.dto.RouteResponse;
import com.returnflow.route.dto.UpdateRouteRequest;

/** ADMIN-only — enforced by {@code auth.security.SecurityConfig}'s {@code hasRole("ADMIN")} rule, not just here. */
@RestController
@RequestMapping("/api/v1/admin/routes")
class RouteAdminController {

	private final RouteAdminService routeAdminService;

	RouteAdminController(RouteAdminService routeAdminService) {
		this.routeAdminService = routeAdminService;
	}

	@PostMapping
	ResponseEntity<RouteResponse> create(@Valid @RequestBody CreateRouteRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(routeAdminService.create(request));
	}

	@GetMapping
	ResponseEntity<List<RouteResponse>> list() {
		return ResponseEntity.ok(routeAdminService.list());
	}

	@GetMapping("/{routeId}")
	ResponseEntity<RouteResponse> get(@PathVariable UUID routeId) {
		return ResponseEntity.ok(routeAdminService.get(routeId));
	}

	@PutMapping("/{routeId}")
	ResponseEntity<RouteResponse> update(@PathVariable UUID routeId, @Valid @RequestBody UpdateRouteRequest request) {
		return ResponseEntity.ok(routeAdminService.update(routeId, request));
	}
}
