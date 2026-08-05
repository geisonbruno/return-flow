package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.UUID;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnStatus;
import com.returnflow.returnrecord.ReturnUnit;
import com.returnflow.route.dto.RouteSummaryResponse;

/**
 * One row of the ADMIN returns list ({@code docs/WEB_UX.md} §6's minimum
 * table columns). No reviewer or review-timestamp field: the domain has no
 * such data until Phase 7A, and a field that is always {@code null} with no
 * real backing concept would misrepresent what this phase actually
 * delivers — see {@code PROGRESS.md} Known issues. {@code photoCount} and
 * {@code hasSignature} give the same lightweight media-presence signal the
 * mobile app already shows on My Returns, without embedding any media
 * content or metadata here.
 */
public record AdminReturnListItemResponse(
		UUID id,
		String returnNumber,
		String customerName,
		String productName,
		int quantity,
		ReturnUnit unit,
		ReturnReason reason,
		ReturnStatus status,
		DriverSummaryResponse driver,
		RouteSummaryResponse route,
		Instant createdAt,
		int photoCount,
		boolean hasSignature) {
}
