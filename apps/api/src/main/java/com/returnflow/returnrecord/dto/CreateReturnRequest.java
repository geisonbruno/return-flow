package com.returnflow.returnrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnUnit;

/**
 * {@code reasonDetails} is intentionally not {@code @NotBlank} here — it is
 * only conditionally required (when {@code reason} is {@code OTHER}), a
 * rule the domain layer ({@code ReturnRecordCreator}) enforces since Bean
 * Validation cannot express cross-field conditional requirements cleanly.
 */
public record CreateReturnRequest(
		@NotBlank @Size(max = 200) String customerName,
		@NotNull ReturnReason reason,
		@Size(max = 500) String reasonDetails,
		@NotNull @Positive Integer quantity,
		@NotNull ReturnUnit unit,
		@NotBlank @Size(max = 2000) String observation) {
}
