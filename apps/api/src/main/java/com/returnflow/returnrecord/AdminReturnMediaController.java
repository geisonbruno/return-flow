package com.returnflow.returnrecord;

import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ADMIN-only authenticated media content — the only place a photo's or
 * signature's binary content is ever returned to an ADMIN. Private by
 * construction: ADMIN role + tenant scoping in {@code AdminReturnMediaService},
 * {@code Cache-Control: private, no-store}, and a generic
 * {@code Content-Disposition} filename that never echoes the storage key —
 * mirroring the DRIVER content endpoints exactly. No upload, replace, or
 * delete endpoint here: the warehouse signature is written only by
 * {@code AdminReturnReviewService.close(...)} (Phase 7A).
 */
@RestController
@RequestMapping("/api/v1/admin/returns/{returnId}")
class AdminReturnMediaController {

	private static final MediaType SVG_MEDIA_TYPE = MediaType.valueOf("image/svg+xml");

	private final AdminReturnMediaService adminReturnMediaService;

	AdminReturnMediaController(AdminReturnMediaService adminReturnMediaService) {
		this.adminReturnMediaService = adminReturnMediaService;
	}

	@GetMapping("/photos/{photoId}/content")
	ResponseEntity<byte[]> photoContent(@PathVariable UUID returnId, @PathVariable UUID photoId) {
		ReturnPhotoService.PhotoContent content = adminReturnMediaService.photoContent(returnId, photoId);
		return ResponseEntity.ok()
				.contentType(MediaType.IMAGE_JPEG)
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"return-photo.jpg\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.body(content.bytes());
	}

	@GetMapping("/signature/content")
	ResponseEntity<byte[]> signatureContent(@PathVariable UUID returnId) {
		ReturnSignatureService.SignatureContent content = adminReturnMediaService.signatureContent(returnId);
		return ResponseEntity.ok()
				.contentType(SVG_MEDIA_TYPE)
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"customer-signature.svg\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.header("X-Content-Type-Options", "nosniff")
				.body(content.bytes());
	}

	/** Only reachable once a warehouse signature exists (i.e. after Close) — {@code Warehouse Signature Not Found} (404) otherwise. */
	@GetMapping("/warehouse-signature/content")
	ResponseEntity<byte[]> warehouseSignatureContent(@PathVariable UUID returnId) {
		ReturnSignatureService.SignatureContent content = adminReturnMediaService.warehouseSignatureContent(returnId);
		return ResponseEntity.ok()
				.contentType(SVG_MEDIA_TYPE)
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"warehouse-signature.svg\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.header("X-Content-Type-Options", "nosniff")
				.body(content.bytes());
	}
}
