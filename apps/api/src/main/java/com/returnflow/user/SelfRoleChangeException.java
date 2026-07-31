package com.returnflow.user;

/** Thrown when the authenticated admin attempts to change their own role away from ADMIN. */
class SelfRoleChangeException extends RuntimeException {
}
