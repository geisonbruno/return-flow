package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.UUID;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnStatus;
import com.returnflow.returnrecord.ReturnUnit;
import com.returnflow.route.dto.RouteSummaryResponse;

/**
 * One row of the ADMIN returns list ({@code docs/WEB_UX.md} §6's minimum
 * table columns). {@code reviewer} is {@code null} until a review has
 * started (root {@code CLAUDE.md} §17.2's "reviewer (when in review or
 * closed)" column) and remains set after {@code CLOSED} — a return
 * cancelled before any review starts keeps it {@code null}. {@code photoCount}
 * and {@code hasSignature} give the same lightweight media-presence signal
 * the mobile app already shows on My Returns, without embedding any media
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
		AdminSummaryResponse reviewer,
		Instant createdAt,
		int photoCount,
		boolean hasSignature) {
}
