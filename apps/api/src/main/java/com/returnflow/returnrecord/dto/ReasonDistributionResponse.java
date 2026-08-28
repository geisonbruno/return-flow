package com.returnflow.returnrecord.dto;

import com.returnflow.returnrecord.ReturnReason;

/**
 * One slice of the Reasons Distribution chart. Only reasons with a count
 * greater than zero appear, so an unused reason is absent rather than a zero
 * row.
 *
 * <p>The enum value is the contract — the Web owns the user-facing label.
 * Percentages are not computed here: the frontend sums the counts.
 */
public record ReasonDistributionResponse(ReturnReason reason, long count) {
}
