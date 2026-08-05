package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnStatus;
import com.returnflow.returnrecord.ReturnUnit;
import com.returnflow.route.dto.RouteSummaryResponse;

/**
 * ADMIN-facing return detail ({@code docs/WEB_UX.md} §7). {@code photos}
 * and {@code signature} reuse the exact same safe DTOs the DRIVER API
 * already returns, but with an ADMIN-scoped {@code contentPath} — see
 * {@code AdminReturnService}. No reviewer, review timestamps, warehouse
 * decision fields, or cancellation metadata: none of that data exists in
 * the domain until Phase 7A, so nothing is fabricated here — see
 * {@code PROGRESS.md} Known issues. "Customer representative name" (root
 * {@code CLAUDE.md} §11.2/§13) is already covered by {@code signature.signerName}
 * when a signature exists.
 */
public record AdminReturnDetailResponse(
		UUID id,
		String returnNumber,
		ReturnStatus status,
		String customerName,
		String productName,
		int quantity,
		ReturnUnit unit,
		ReturnReason reason,
		String reasonDetails,
		String observation,
		DriverSummaryResponse driver,
		RouteSummaryResponse route,
		List<ReturnPhotoResponse> photos,
		ReturnSignatureResponse signature,
		Instant createdAt,
		Instant updatedAt) {
}
