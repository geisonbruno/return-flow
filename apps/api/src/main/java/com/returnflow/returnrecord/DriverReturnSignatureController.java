package com.returnflow.returnrecord;

import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.CreateReturnSignatureRequest;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;

/**
 * DRIVER-only, same enforcement as {@link DriverReturnController} —
 * {@code auth.security.SecurityConfig}'s {@code hasRole("DRIVER")} rule
 * already covers everything under {@code /api/v1/driver/**}. A separate
 * controller from {@link DriverReturnController}/{@link DriverReturnPhotoController},
 * matching the same "distinct enough concern" reasoning that already split
 * photos out.
 */
@RestController
@RequestMapping("/api/v1/driver/returns/{returnId}/signature")
class DriverReturnSignatureController {

	private static final MediaType SVG_MEDIA_TYPE = MediaType.valueOf("image/svg+xml");

	private final ReturnSignatureService returnSignatureService;

	DriverReturnSignatureController(ReturnSignatureService returnSignatureService) {
		this.returnSignatureService = returnSignatureService;
	}

	@PostMapping
	ResponseEntity<ReturnSignatureResponse> create(@PathVariable UUID returnId, @Valid @RequestBody CreateReturnSignatureRequest request,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.status(HttpStatus.CREATED).body(returnSignatureService.create(returnId, request, principal));
	}

	@GetMapping
	ResponseEntity<ReturnSignatureResponse> get(@PathVariable UUID returnId, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(returnSignatureService.get(returnId, principal));
	}

	/**
	 * The only place a signature's binary content is ever returned. Private
	 * by construction — DRIVER auth + tenant/ownership checks in
	 * {@code ReturnSignatureService}, {@code Cache-Control: private, no-store},
	 * {@code X-Content-Type-Options: nosniff} (the generated SVG must never be
	 * sniffed as HTML), and a generic {@code Content-Disposition} filename
	 * that never echoes the storage key.
	 */
	@GetMapping("/content")
	ResponseEntity<byte[]> content(@PathVariable UUID returnId, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
		ReturnSignatureService.SignatureContent content = returnSignatureService.content(returnId, principal);
		return ResponseEntity.ok()
				.contentType(SVG_MEDIA_TYPE)
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"customer-signature.svg\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.header("X-Content-Type-Options", "nosniff")
				.body(content.bytes());
	}
}
