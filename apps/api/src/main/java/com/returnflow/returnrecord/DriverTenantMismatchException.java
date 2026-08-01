package com.returnflow.returnrecord;

/** Thrown when the driver of a new return does not belong to the tenant the return is being created for. */
class DriverTenantMismatchException extends RuntimeException {
}
