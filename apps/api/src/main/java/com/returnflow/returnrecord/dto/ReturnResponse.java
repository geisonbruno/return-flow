package com.returnflow.returnrecord.dto;

import java.time.Instant;
import java.util.UUID;

import com.returnflow.returnrecord.ReturnReason;
import com.returnflow.returnrecord.ReturnStatus;
import com.returnflow.returnrecord.ReturnUnit;
import com.returnflow.route.dto.RouteSummaryResponse;

/** No warehouse-only fields — this phase implements no warehouse review, so none exist to leak yet. */
public record ReturnResponse(
		UUID id,
		String returnNumber,
		String customerName,
		ReturnReason reason,
		String reasonDetails,
		int quantity,
		ReturnUnit unit,
		String observation,
		ReturnStatus status,
		DriverSummaryResponse driver,
		RouteSummaryResponse route,
		Instant createdAt,
		Instant updatedAt) {
}
