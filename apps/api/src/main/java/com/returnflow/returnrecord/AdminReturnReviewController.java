package com.returnflow.returnrecord;

import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.AdminReturnDetailResponse;
import com.returnflow.returnrecord.dto.CancelReturnRequest;
import com.returnflow.returnrecord.dto.CloseReturnRequest;
import com.returnflow.returnrecord.dto.TakeOverReviewRequest;

/**
 * ADMIN-only warehouse-review lifecycle actions (Phase 7A) — enforced by
 * {@code auth.security.SecurityConfig}'s {@code hasRole("ADMIN")} rule, not
 * just here. Every action endpoint here represents an explicit domain
 * transition; none accepts a client-supplied status, reviewer, closer, or
 * canceller — those always come from {@link AuthenticatedPrincipal} or
 * {@code TenantContext}. Every response is the same {@link AdminReturnDetailResponse}
 * shape {@code GET /api/v1/admin/returns/{returnId}} already returns,
 * reflecting the return's new state after the transition.
 */
@RestController
@RequestMapping("/api/v1/admin/returns/{returnId}")
class AdminReturnReviewController {

	private final AdminReturnReviewService adminReturnReviewService;

	AdminReturnReviewController(AdminReturnReviewService adminReturnReviewService) {
		this.adminReturnReviewService = adminReturnReviewService;
	}

	@PostMapping("/start-review")
	ResponseEntity<AdminReturnDetailResponse> startReview(@PathVariable UUID returnId,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(adminReturnReviewService.startReview(returnId, principal));
	}

	@PostMapping("/release-review")
	ResponseEntity<AdminReturnDetailResponse> releaseReview(@PathVariable UUID returnId,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(adminReturnReviewService.releaseReview(returnId, principal));
	}

	@PostMapping("/take-over-review")
	ResponseEntity<AdminReturnDetailResponse> takeOverReview(@PathVariable UUID returnId,
			@Valid @RequestBody TakeOverReviewRequest request, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(adminReturnReviewService.takeOverReview(returnId, request, principal));
	}

	@PostMapping("/close")
	ResponseEntity<AdminReturnDetailResponse> close(@PathVariable UUID returnId,
			@Valid @RequestBody CloseReturnRequest request, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(adminReturnReviewService.close(returnId, request, principal));
	}

	@PostMapping("/cancel")
	ResponseEntity<AdminReturnDetailResponse> cancel(@PathVariable UUID returnId,
			@Valid @RequestBody CancelReturnRequest request, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(adminReturnReviewService.cancel(returnId, request, principal));
	}
}
