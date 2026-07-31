package com.returnflow.user;

/** Thrown when a normalized email is already in use by another user (globally unique — see Phase 2B). */
class DuplicateEmailException extends RuntimeException {
}
