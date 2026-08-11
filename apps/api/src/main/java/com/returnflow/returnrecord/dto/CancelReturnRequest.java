package com.returnflow.returnrecord.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Root {@code CLAUDE.md} §9.4: a cancellation reason is always required. */
public record CancelReturnRequest(@NotBlank @Size(max = 500) String reason) {
}
