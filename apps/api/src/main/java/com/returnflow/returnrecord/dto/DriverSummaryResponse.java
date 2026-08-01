package com.returnflow.returnrecord.dto;

import java.util.UUID;

/** The small nested driver representation embedded in a return response — no email, no route, no active flag. */
public record DriverSummaryResponse(UUID id, String fullName) {
}
