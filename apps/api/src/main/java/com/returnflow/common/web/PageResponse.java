package com.returnflow.common.web;

import java.util.List;

/**
 * Explicit server-side-pagination envelope, deliberately not Spring Data's
 * own {@code Page<T>} (which would serialize Spring-internal structure
 * directly to clients) — the same "no framework type leaks into the API
 * contract" convention already used everywhere else in this codebase.
 */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
}
