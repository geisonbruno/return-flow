package com.returnflow.returnrecord;

/**
 * Thrown when a DRIVER attempts to upload a photo or capture the customer
 * signature outside {@code AWAITING_WAREHOUSE} — root {@code CLAUDE.md} §9.1/§14:
 * "after IN_REVIEW, photos are immutable," and driver editing stops the
 * moment a review starts. Before Phase 7A this check was unreachable (no
 * other status existed yet), so neither {@code ReturnPhotoService} nor
 * {@code ReturnSignatureService} needed it until now.
 */
class ReturnNotEditableException extends RuntimeException {
}
