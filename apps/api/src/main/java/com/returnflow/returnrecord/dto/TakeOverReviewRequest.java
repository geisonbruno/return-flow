package com.returnflow.returnrecord.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;

/**
 * {@code expectedCurrentReviewerId} is the reviewer the client last observed
 * (e.g. from {@code AdminReturnDetailResponse.reviewer.id}) — the takeover
 * is rejected with a conflict if the return's actual current reviewer has
 * since changed, so a stale client view can never blindly overwrite a more
 * recent takeover or release.
 */
public record TakeOverReviewRequest(@NotNull UUID expectedCurrentReviewerId) {
}
