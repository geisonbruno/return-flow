package com.returnflow.auth;

/**
 * Thrown by {@link AuthenticationService#currentUser} when a still-valid
 * access token belongs to a user deactivated after the token was issued. A
 * distinct, more specific message is safe here (unlike login/refresh
 * failures) because the caller already holds a validly-signed token — there
 * is no account-enumeration concern for an already-authenticated party.
 */
class InactiveUserException extends RuntimeException {
}
