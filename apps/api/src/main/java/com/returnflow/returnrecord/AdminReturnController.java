package com.returnflow.returnrecord;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.common.web.PageResponse;
import com.returnflow.returnrecord.dto.AdminReturnDetailResponse;
import com.returnflow.returnrecord.dto.AdminReturnListItemResponse;

/**
 * ADMIN-only, read-only (Phase 6A) — enforced by {@code auth.security.SecurityConfig}'s
 * {@code hasRole("ADMIN")} rule, not just here. Deliberately no
 * PUT/PATCH/DELETE and no status-transition endpoint: review, close,
 * cancel, and every other mutation belong to Phase 7A.
 *
 * <p>{@code status}/{@code reason}/{@code createdFrom}/{@code createdTo}
 * are accepted as plain strings, not bound enum/{@code LocalDate}
 * parameters, so an invalid value reaches {@code AdminReturnService}'s own
 * validation and this module's {@code InvalidReturnFilterException} —
 * a safe {@code ProblemDetail} — rather than a generic Spring MVC
 * type-mismatch failure.
 */
@RestController
@RequestMapping("/api/v1/admin/returns")
class AdminReturnController {

	private final AdminReturnService adminReturnService;

	AdminReturnController(AdminReturnService adminReturnService) {
		this.adminReturnService = adminReturnService;
	}

	@GetMapping
	ResponseEntity<PageResponse<AdminReturnListItemResponse>> list(
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "25") int size,
			@RequestParam(required = false) String search,
			@RequestParam(required = false) String status,
			@RequestParam(required = false) String reason,
			@RequestParam(required = false) String createdFrom,
			@RequestParam(required = false) String createdTo,
			@RequestParam(required = false) UUID driverId,
			@RequestParam(required = false) UUID routeId) {
		AdminReturnListQuery query = new AdminReturnListQuery(page, size, search, status, reason, createdFrom, createdTo, driverId, routeId);
		return ResponseEntity.ok(adminReturnService.list(query));
	}

	@GetMapping("/{returnId}")
	ResponseEntity<AdminReturnDetailResponse> get(@PathVariable UUID returnId) {
		return ResponseEntity.ok(adminReturnService.get(returnId));
	}
}
