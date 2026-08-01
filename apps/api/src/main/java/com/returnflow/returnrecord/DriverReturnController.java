package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.CreateReturnRequest;
import com.returnflow.returnrecord.dto.ReturnResponse;

/**
 * DRIVER-only — enforced by {@code auth.security.SecurityConfig}'s
 * {@code hasRole("DRIVER")} rule, not just here. Deliberately no
 * PUT/PATCH/DELETE and no status-transition endpoint: editing, review, and
 * lifecycle transitions are out of scope for this phase.
 */
@RestController
@RequestMapping("/api/v1/driver/returns")
class DriverReturnController {

	private final DriverReturnService driverReturnService;

	DriverReturnController(DriverReturnService driverReturnService) {
		this.driverReturnService = driverReturnService;
	}

	@PostMapping
	ResponseEntity<ReturnResponse> create(@Valid @RequestBody CreateReturnRequest request,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.status(HttpStatus.CREATED).body(driverReturnService.create(request, principal));
	}

	@GetMapping
	ResponseEntity<List<ReturnResponse>> list(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(driverReturnService.list(principal));
	}

	@GetMapping("/{returnId}")
	ResponseEntity<ReturnResponse> get(@PathVariable UUID returnId, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(driverReturnService.get(returnId, principal));
	}
}
