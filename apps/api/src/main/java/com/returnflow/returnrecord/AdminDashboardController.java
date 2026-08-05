package com.returnflow.returnrecord;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.returnrecord.dto.AdminReturnSummaryResponse;

/** ADMIN-only — enforced by {@code auth.security.SecurityConfig}'s {@code hasRole("ADMIN")} rule, not just here. */
@RestController
@RequestMapping("/api/v1/admin/dashboard")
class AdminDashboardController {

	private final AdminReturnService adminReturnService;

	AdminDashboardController(AdminReturnService adminReturnService) {
		this.adminReturnService = adminReturnService;
	}

	@GetMapping("/summary")
	ResponseEntity<AdminReturnSummaryResponse> summary() {
		return ResponseEntity.ok(adminReturnService.summary());
	}
}
