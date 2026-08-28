package com.returnflow.returnrecord;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.returnrecord.dto.AdminReturnAnalyticsResponse;
import com.returnflow.returnrecord.dto.AdminReturnSummaryResponse;

/** ADMIN-only — enforced by {@code auth.security.SecurityConfig}'s {@code hasRole("ADMIN")} rule, not just here. */
@RestController
@RequestMapping("/api/v1/admin/dashboard")
class AdminDashboardController {

	private final AdminReturnService adminReturnService;
	private final AdminReturnAnalyticsService adminReturnAnalyticsService;

	AdminDashboardController(AdminReturnService adminReturnService, AdminReturnAnalyticsService adminReturnAnalyticsService) {
		this.adminReturnService = adminReturnService;
		this.adminReturnAnalyticsService = adminReturnAnalyticsService;
	}

	/**
	 * The four current-state summary cards. Deliberately takes no date range:
	 * Waiting Warehouse / In Review / Closed Today / Returns Today describe
	 * today's operational state and must never be reinterpreted through the
	 * analytics range below.
	 */
	@GetMapping("/summary")
	ResponseEntity<AdminReturnSummaryResponse> summary() {
		return ResponseEntity.ok(adminReturnService.summary());
	}

	/**
	 * The three approved Dashboard charts, all over one shared range of Sydney
	 * operational calendar dates ({@code from}/{@code to}, {@code YYYY-MM-DD},
	 * both inclusive and both required).
	 *
	 * <p>Accepted as plain strings, not bound {@code LocalDate} parameters, so
	 * a missing or malformed value reaches {@code AdminReturnAnalyticsService}'s
	 * own validation and this module's {@code InvalidReturnFilterException} — a
	 * safe {@code ProblemDetail} — rather than a generic Spring MVC
	 * type-mismatch failure. This mirrors {@code AdminReturnController}'s
	 * handling of the returns-list date filters exactly.
	 */
	@GetMapping("/analytics")
	ResponseEntity<AdminReturnAnalyticsResponse> analytics(
			@RequestParam(required = false) String from,
			@RequestParam(required = false) String to) {
		return ResponseEntity.ok(adminReturnAnalyticsService.analytics(from, to));
	}
}
