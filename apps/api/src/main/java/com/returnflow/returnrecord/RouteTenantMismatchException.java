package com.returnflow.returnrecord;

/**
 * Thrown when the driver's assigned route doesn't resolve inside the
 * return's own tenant. Under Phase 2C's own invariants a {@code DRIVER}'s
 * route assignment should never actually diverge from the driver's tenant —
 * this is defense in depth, not a reachable path through normal API usage.
 */
class RouteTenantMismatchException extends RuntimeException {
}
