package com.returnflow.returnrecord.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code strokes} is intentionally only {@code @NotNull} here — its deeper
 * shape (stroke/point counts, coordinate bounds, minimum drawn length) is
 * validated inside {@code returnrecord.ReturnSignatureService}, the same
 * "structural Bean Validation, semantic domain validation" split already
 * used by {@code CreateReturnRequest.reasonDetails}.
 */
public record CreateReturnSignatureRequest(
		@NotBlank @Size(max = 100) String signerName,
		@NotNull List<List<SignaturePointRequest>> strokes) {
}
