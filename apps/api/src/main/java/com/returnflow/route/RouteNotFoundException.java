package com.returnflow.route;

/**
 * Thrown when a route ID doesn't resolve inside the caller's own tenant —
 * including when it exists but belongs to a different tenant. Both cases are
 * deliberately indistinguishable to the caller (see root CLAUDE.md §21.1:
 * cross-tenant records behave as not found).
 */
public class RouteNotFoundException extends RuntimeException {
}
