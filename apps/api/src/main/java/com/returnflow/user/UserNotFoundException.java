package com.returnflow.user;

/**
 * Thrown when a user ID doesn't resolve inside the caller's own tenant —
 * including when it exists but belongs to a different tenant (both cases
 * are deliberately indistinguishable to the caller).
 */
class UserNotFoundException extends RuntimeException {
}
