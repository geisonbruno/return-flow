package com.returnflow.returnrecord.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * The single atomic Close payload — no separate draft/autosave endpoint
 * exists (root {@code CLAUDE.md} §12, {@code docs/WEB_UX.md} §8's Resolved
 * MVP decision). {@code warehouseRepresentativeName} doubles as the
 * warehouse signature's signer name, the same "the signature's signer name
 * IS the representative name" pattern Phase 5B established for the customer
 * side — no separate field is stored twice. {@code warehouseSignatureStrokes}'
 * deeper shape (stroke/point counts, coordinate bounds, minimum drawn
 * length) is validated inside {@code returnrecord.AdminReturnReviewService}
 * via the same {@code SignatureStrokeValidator} the customer signature uses.
 */
public record CloseReturnRequest(
		@NotNull Boolean sellable,
		@NotNull Boolean creditCustomer,
		@NotNull Boolean chargeCustomer,
		@NotNull Boolean chargeDriver,
		@Size(max = 2000) String warehouseObservation,
		@NotBlank @Size(max = 100) String warehouseRepresentativeName,
		@NotNull List<List<SignaturePointRequest>> warehouseSignatureStrokes) {
}
