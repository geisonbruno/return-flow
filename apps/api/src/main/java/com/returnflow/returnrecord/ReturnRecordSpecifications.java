package com.returnflow.returnrecord;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;

/**
 * Composable {@link Specification} predicates for the ADMIN returns list
 * ({@code AdminReturnService.list}) — chosen over a generic query framework
 * or QueryDSL because the filter set is small, fixed, and already fully
 * described by root {@code CLAUDE.md} §17.2/§26 and {@code docs/WEB_UX.md}
 * §6. {@code Specification.where(null)}/{@code .and(null)} are no-ops in
 * Spring Data JPA, so every predicate here can return {@code null} for "not
 * applicable" without special-casing the caller.
 */
final class ReturnRecordSpecifications {

	private ReturnRecordSpecifications() {
	}

	static Specification<ReturnRecord> forTenant(UUID tenantId) {
		return (root, query, cb) -> cb.equal(root.get("tenant").get("id"), tenantId);
	}

	static Specification<ReturnRecord> hasStatus(ReturnStatus status) {
		if (status == null) {
			return null;
		}
		return (root, query, cb) -> cb.equal(root.get("status"), status);
	}

	static Specification<ReturnRecord> hasReason(ReturnReason reason) {
		if (reason == null) {
			return null;
		}
		return (root, query, cb) -> cb.equal(root.get("reason"), reason);
	}

	/** {@code from} inclusive, {@code to} exclusive — either may be {@code null} for an open-ended range. */
	static Specification<ReturnRecord> createdBetween(Instant from, Instant to) {
		if (from == null && to == null) {
			return null;
		}
		if (from != null && to != null) {
			return (root, query, cb) -> cb.and(cb.greaterThanOrEqualTo(root.get("createdAt"), from), cb.lessThan(root.get("createdAt"), to));
		}
		if (from != null) {
			return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from);
		}
		return (root, query, cb) -> cb.lessThan(root.get("createdAt"), to);
	}

	static Specification<ReturnRecord> hasDriver(UUID driverId) {
		if (driverId == null) {
			return null;
		}
		return (root, query, cb) -> cb.equal(root.get("driver").get("id"), driverId);
	}

	static Specification<ReturnRecord> hasRoute(UUID routeId) {
		if (routeId == null) {
			return null;
		}
		return (root, query, cb) -> cb.equal(root.get("route").get("id"), routeId);
	}

	/** Case-insensitive match against return number, customer, product, driver name, and route code/name (root {@code CLAUDE.md} §17.2). */
	static Specification<ReturnRecord> matchesSearch(String search) {
		if (search == null || search.isBlank()) {
			return null;
		}
		String pattern = "%" + search.trim().toLowerCase() + "%";
		return (root, query, cb) -> {
			Join<Object, Object> driver = root.join("driver", JoinType.LEFT);
			Join<Object, Object> route = root.join("route", JoinType.LEFT);
			return cb.or(
					cb.like(cb.lower(root.get("returnNumber")), pattern),
					cb.like(cb.lower(root.get("customerName")), pattern),
					cb.like(cb.lower(root.get("productName")), pattern),
					cb.like(cb.lower(driver.get("fullName")), pattern),
					cb.like(cb.lower(route.get("code")), pattern),
					cb.like(cb.lower(route.get("name")), pattern));
		};
	}
}
