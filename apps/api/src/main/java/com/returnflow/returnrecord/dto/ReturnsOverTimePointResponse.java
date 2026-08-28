package com.returnflow.returnrecord.dto;

import java.time.LocalDate;

/**
 * One point on the Returns Over Time series: the Sydney operational calendar
 * date a return was created on, and how many were created that day.
 *
 * <p>Every calendar date from {@code from} through {@code to} is present,
 * including days with {@code count == 0}, so the frontend line chart has a
 * continuous timeline without inferring gaps.
 */
public record ReturnsOverTimePointResponse(LocalDate date, long count) {
}
