package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Public photo metadata only — never {@code storageKey}, {@code tenantId},
 * {@code driverId}, or a filesystem path. {@code contentPath} is an
 * API-relative reference (never an absolute/localhost URL, never a token in
 * the query string) the client resolves against its own configured API base
 * URL to fetch the binary content through an authenticated request.
 */
public record ReturnPhotoResponse(UUID id, String contentType, int sizeBytes, int position, String contentPath, Instant createdAt) {
}
