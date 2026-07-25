package com.returnflow.common.error.support;

import jakarta.validation.constraints.NotBlank;

public record TestPayload(@NotBlank String name) {
}
