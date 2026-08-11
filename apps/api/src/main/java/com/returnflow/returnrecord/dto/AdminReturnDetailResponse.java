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
 * and {@code signature} (the customer signature) reuse the exact same safe
 * DTOs the DRIVER API already returns, but with an ADMIN-scoped
 * {@code contentPath} — see {@code AdminReturnService}.
 *
 * <p>Everything from {@code reviewer} onward reflects the Phase 7A warehouse
 * lifecycle and is {@code null} until the corresponding transition happens:
 * {@code reviewer}/{@code reviewStartedAt} only while/after a review has
 * started; {@code sellable}/{@code creditCustomer}/{@code chargeCustomer}/
 * {@code chargeDriver}/{@code warehouseObservation}/{@code warehouseRepresentativeName}/
 * {@code warehouseSignature}/{@code closedBy}/{@code closedAt} only once
 * {@code CLOSED}; {@code cancelledBy}/{@code cancelledAt}/{@code cancellationReason}
 * only once {@code CANCELLED}. {@code warehouseRepresentativeName} is derived
 * from {@code warehouseSignature.signerName} — the same "the signature's
 * signer name IS the representative name" pattern Phase 5B already
 * established for the customer side (see {@code signature.signerName}).
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
		AdminSummaryResponse reviewer,
		Instant reviewStartedAt,
		Boolean sellable,
		Boolean creditCustomer,
		Boolean chargeCustomer,
		Boolean chargeDriver,
		String warehouseObservation,
		String warehouseRepresentativeName,
		ReturnSignatureResponse warehouseSignature,
		AdminSummaryResponse closedBy,
		Instant closedAt,
		AdminSummaryResponse cancelledBy,
		Instant cancelledAt,
		String cancellationReason,
		Instant createdAt,
		Instant updatedAt) {
}
