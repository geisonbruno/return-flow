package com.returnflow.returnrecord.dto;

import java.util.UUID;

/**
 * One bar of the Top Routes by Returns chart, carrying enough stable route
 * identity for the existing UI without embedding the route's current active
 * flag: a route that has since been deactivated still owns its historical
 * returns and is still reported here.
 *
 * <p>{@code routeCode}/{@code routeName} come from the route the return was
 * actually created against ({@code ReturnRecord.route} — the snapshot taken
 * at creation, per root {@code CLAUDE.md} §11.5), not from a second route
 * copy invented for analytics.
 */
public record TopRouteResponse(UUID routeId, String routeCode, String routeName, long count) {
}
