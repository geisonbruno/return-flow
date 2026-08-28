package com.returnflow.returnrecord;

/** One row of {@code ReturnRecordRepository.countByReasonCreatedBetween} — a reason with at least one return in the range. */
interface ReturnCountByReasonProjection {

	ReturnReason getReason();

	long getTotal();
}
