package com.returnflow.route.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Routes are always created active; there is no {@code active} field here. */
public record CreateRouteRequest(@NotBlank @Size(max = 50) String code, @Size(max = 255) String name) {
}
