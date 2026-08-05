package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Public signature metadata only — never {@code storageKey}, {@code tenantId},
 * {@code driverId}, raw strokes, or the generated SVG itself. {@code contentPath}
 * is an API-relative reference the client resolves against its own configured
 * API base URL to fetch the SVG through an authenticated request, mirroring
 * {@link ReturnPhotoResponse#contentPath()}.
 */
public record ReturnSignatureResponse(UUID id, String signerName, String contentType, int sizeBytes, String contentPath, Instant signedAt) {
}
