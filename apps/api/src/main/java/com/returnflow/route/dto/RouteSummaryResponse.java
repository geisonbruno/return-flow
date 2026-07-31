package com.returnflow.route.dto;

import java.util.UUID;

/** The small nested representation embedded in a user response — no timestamps. */
public record RouteSummaryResponse(UUID id, String code, String name, boolean active) {
}
