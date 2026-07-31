package com.returnflow.auth;

/**
 * Thrown by {@link AuthenticationService#refresh} when the submitted refresh
 * token is missing, expired, revoked, already rotated, or belongs to an
 * inactive user — one exception, one message, for the same reason
 * {@link InvalidCredentialsException} doesn't distinguish its causes.
 */
class InvalidRefreshTokenException extends RuntimeException {
}
