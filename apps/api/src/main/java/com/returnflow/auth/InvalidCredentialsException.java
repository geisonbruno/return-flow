package com.returnflow.auth;

/**
 * Thrown by {@link AuthenticationService#login} for unknown email, wrong
 * password, or an inactive account alike — deliberately one exception with
 * one message so a failed login never reveals which of those actually
 * happened (no account-enumeration signal).
 */
class InvalidCredentialsException extends RuntimeException {
}
