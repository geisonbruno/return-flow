package com.returnflow.returnrecord.dto;

import java.util.UUID;

/** The small nested ADMIN representation embedded in a return response — reviewer, closer, or canceller. No email, no role. */
public record AdminSummaryResponse(UUID id, String fullName) {
}
