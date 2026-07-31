package com.returnflow.user;

/** Thrown when the authenticated admin attempts to deactivate their own account. */
class SelfDeactivationException extends RuntimeException {
}
