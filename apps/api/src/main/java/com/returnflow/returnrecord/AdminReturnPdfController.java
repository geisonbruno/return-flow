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
 * ADMIN-only administrative PDF for a closed return (Phase 9). Separate from
 * {@link AdminReturnMediaController} because this is not stored media: the
 * bytes are generated per request from the database and never persisted.
 *
 * <p>The request carries nothing but the return identifier — no display
 * values from the browser can influence the document. Non-closed returns are
 * rejected as an {@code Invalid Return State} conflict by
 * {@link AdminReturnPdfService}, and a return outside the caller's tenant is
 * reported as not found, matching the rest of the ADMIN return API.
 */
@RestController
@RequestMapping("/api/v1/admin/returns/{returnId}")
class AdminReturnPdfController {

	private final AdminReturnPdfService adminReturnPdfService;

	AdminReturnPdfController(AdminReturnPdfService adminReturnPdfService) {
		this.adminReturnPdfService = adminReturnPdfService;
	}

	@GetMapping("/pdf")
	ResponseEntity<byte[]> pdf(@PathVariable UUID returnId) {
		AdminReturnPdfService.ReturnPdf pdf = adminReturnPdfService.generate(returnId);
		return ResponseEntity.ok()
				.contentType(MediaType.APPLICATION_PDF)
				.header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename(pdf.returnNumber()) + "\"")
				.header(HttpHeaders.CACHE_CONTROL, "private, no-store")
				.header("X-Content-Type-Options", "nosniff")
				.body(pdf.bytes());
	}

	/**
	 * Return numbers are backend-generated and already safe, but the filename
	 * is still built from a whitelist rather than by interpolating the value
	 * directly: nothing that could break out of the quoted
	 * {@code Content-Disposition} header (a quote, a semicolon, CR/LF) can
	 * survive. No storage key or filesystem path is ever exposed here.
	 */
	private static String filename(String returnNumber) {
		StringBuilder safe = new StringBuilder(returnNumber.length());
		for (int i = 0; i < returnNumber.length(); i++) {
			char character = returnNumber.charAt(i);
			boolean allowed = (character >= 'A' && character <= 'Z')
					|| (character >= 'a' && character <= 'z')
					|| (character >= '0' && character <= '9')
					|| character == '-' || character == '_';
			safe.append(allowed ? character : '-');
		}
		return "ReturnFlow-" + safe + ".pdf";
	}
}
