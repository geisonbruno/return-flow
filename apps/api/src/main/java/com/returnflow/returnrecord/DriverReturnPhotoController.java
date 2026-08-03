package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.ReturnPhotoResponse;

/**
 * DRIVER-only, same enforcement as {@link DriverReturnController} —
 * {@code auth.security.SecurityConfig}'s {@code hasRole("DRIVER")} rule
 * already covers everything under {@code /api/v1/driver/**}, so no
 * additional wiring was needed here. A separate controller from
 * {@link DriverReturnController} because multipart upload and binary
 * streaming are a distinct enough concern to keep the return CRUD
 * controller uncluttered.
 */
@RestController
@RequestMapping("/api/v1/driver/returns/{returnId}/photos")
class DriverReturnPhotoController {

	private final ReturnPhotoService returnPhotoService;

	DriverReturnPhotoController(ReturnPhotoService returnPhotoService) {
		this.returnPhotoService = returnPhotoService;
	}

	@PostMapping
	ResponseEntity<ReturnPhotoResponse> upload(@PathVariable UUID returnId, @RequestParam("file") MultipartFile file,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.status(HttpStatus.CREATED).body(returnPhotoService.upload(returnId, file, principal));
	}

	@GetMapping
	ResponseEntity<List<ReturnPhotoResponse>> list(@PathVariable UUID returnId,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		return ResponseEntity.ok(returnPhotoService.list(returnId, principal));
	}

	/**
	 * The only place a photo's binary content is ever returned. Private by
	 * construction — DRIVER auth + tenant/ownership checks in
	 * {@code ReturnPhotoService}, {@code Cache-Control: private, no-store},
	 * and a generic {@code Content-Disposition} filename that never echoes
	 * the storage key.
	 */
	@GetMapping("/{photoId}/content")
	ResponseEntity<byte[]> content(@PathVariable UUID returnId, @PathVariable UUID photoId,
			@AuthenticationPrincipal AuthenticatedPrincipal principal) {
		ReturnPhotoService.PhotoContent content = returnPhotoService.content(returnId, photoId, principal);
		return ResponseEntity.ok()
				.contentType(MediaType.IMAGE_JPEG)
				.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"return-photo.jpg\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.body(content.bytes());
	}
}
