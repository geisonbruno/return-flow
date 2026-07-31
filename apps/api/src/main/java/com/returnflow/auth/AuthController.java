package com.returnflow.auth;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.auth.dto.AuthSessionResponse;
import com.returnflow.auth.dto.AuthenticatedUserResponse;
import com.returnflow.auth.dto.LoginRequest;
import com.returnflow.auth.dto.LogoutRequest;
import com.returnflow.auth.dto.RefreshRequest;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

	private final AuthenticationService authenticationService;

	AuthController(AuthenticationService authenticationService) {
		this.authenticationService = authenticationService;
	}

	@PostMapping("/login")
	ResponseEntity<AuthSessionResponse> login(@Valid @RequestBody LoginRequest request) {
		return ResponseEntity.ok(authenticationService.login(request.email(), request.password()));
	}

	@PostMapping("/refresh")
	ResponseEntity<AuthSessionResponse> refresh(@Valid @RequestBody RefreshRequest request) {
		return ResponseEntity.ok(authenticationService.refresh(request.refreshToken()));
	}

	@PostMapping("/logout")
	ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
		authenticationService.logout(request.refreshToken());
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	ResponseEntity<AuthenticatedUserResponse> me(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(authenticationService.currentUser(principal));
	}
}
