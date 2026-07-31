package com.returnflow.route;

/** Thrown when attempting to deactivate a route that at least one active DRIVER still depends on. */
class RouteInUseException extends RuntimeException {
}
