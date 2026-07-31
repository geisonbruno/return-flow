package com.returnflow.user;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.user.dto.CreateUserRequest;
import com.returnflow.user.dto.ResetPasswordRequest;
import com.returnflow.user.dto.UpdateUserRequest;
import com.returnflow.user.dto.UserResponse;

/** ADMIN-only — enforced by {@code auth.security.SecurityConfig}'s {@code hasRole("ADMIN")} rule, not just here. */
@RestController
@RequestMapping("/api/v1/admin/users")
class UserAdminController {

	private final UserAdminService userAdminService;

	UserAdminController(UserAdminService userAdminService) {
		this.userAdminService = userAdminService;
	}

	@PostMapping
	ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(userAdminService.create(request));
	}

	@GetMapping
	ResponseEntity<List<UserResponse>> list() {
		return ResponseEntity.ok(userAdminService.list());
	}

	@GetMapping("/{userId}")
	ResponseEntity<UserResponse> get(@PathVariable UUID userId) {
		return ResponseEntity.ok(userAdminService.get(userId));
	}

	@PutMapping("/{userId}")
	ResponseEntity<UserResponse> update(@PathVariable UUID userId, @Valid @RequestBody UpdateUserRequest request,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(userAdminService.update(userId, request, principal));
	}

	@PostMapping("/{userId}/reset-password")
	ResponseEntity<Void> resetPassword(@PathVariable UUID userId, @Valid @RequestBody ResetPasswordRequest request) {
		userAdminService.resetPassword(userId, request);
		return ResponseEntity.noContent().build();
	}
}
