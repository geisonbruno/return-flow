package com.returnflow.route.dto;

import java.time.Instant;
import java.util.UUID;

public record RouteResponse(UUID id, String code, String name, boolean active, Instant createdAt, Instant updatedAt) {
}
