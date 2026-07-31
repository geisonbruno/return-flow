package com.returnflow.route.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * A full replace, matching PUT semantics — not a partial patch. {@code active}
 * is a nullable {@code Boolean} (not primitive) specifically so an omitted
 * field fails {@code @NotNull} validation instead of silently deserializing
 * to {@code false} and deactivating the route.
 */
public record UpdateRouteRequest(@NotBlank @Size(max = 50) String code, @Size(max = 255) String name, @NotNull Boolean active) {
}
