package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnStatus;
import com.returnflow.returnrecord.ReturnUnit;
import com.returnflow.route.dto.RouteSummaryResponse;

/**
 * No warehouse-only fields — this phase implements no warehouse review, so
 * none exist to leak yet. {@code photos} is always a list, never {@code null}
 * — empty immediately after creation, populated for list/detail responses —
 * and contains only safe {@link ReturnPhotoResponse} metadata, never binary
 * image bytes or Base64 (see {@code storage.ReturnMediaStorage}).
 *
 * <p>{@code signature} is {@code null} until the driver captures the
 * customer signature (Phase 5B) and safe {@link ReturnSignatureResponse}
 * metadata afterward — never raw strokes, Base64, or the generated SVG
 * itself. A return created before Phase 5B, or one whose signature workflow
 * was interrupted, legitimately has {@code signature: null}; clients derive
 * "pending" state from that nullability rather than a separate boolean flag.
 */
public record ReturnResponse(
		UUID id,
		String returnNumber,
		String customerName,
		String productName,
		ReturnReason reason,
		String reasonDetails,
		int quantity,
		ReturnUnit unit,
		String observation,
		ReturnStatus status,
		DriverSummaryResponse driver,
		RouteSummaryResponse route,
		List<ReturnPhotoResponse> photos,
		ReturnSignatureResponse signature,
		Instant createdAt,
		Instant updatedAt) {
}
