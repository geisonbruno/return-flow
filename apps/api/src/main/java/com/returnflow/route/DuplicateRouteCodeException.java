package com.returnflow.route;

/** Thrown when a route code already exists for the same tenant (codes are tenant-scoped, not global). */
class DuplicateRouteCodeException extends RuntimeException {
}
