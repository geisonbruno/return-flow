package com.returnflow.route;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.returnflow.common.audit.Auditable;

/**
 * A tenant-owned operational identifier a driver is assigned to (e.g.
 * "Route 5") — not a GPS route, schedule, or sequence of stops. {@code code}
 * is normalized ({@link RouteCodeNormalizer}) before it ever reaches this
 * constructor or {@link #update}, so uniqueness comparisons never depend on
 * case or incidental whitespace.
 */
@Entity
@Table(name = "route")
public class Route extends Auditable {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "tenant_id", nullable = false)
	private UUID tenantId;

	@Column(nullable = false)
	private String code;

	@Column
	private String name;

	@Column(nullable = false)
	private boolean active;

	protected Route() {
		// JPA
	}

	public Route(UUID tenantId, String code, String name, boolean active) {
		this.tenantId = tenantId;
		this.code = code;
		this.name = name;
		this.active = active;
	}

	public void update(String code, String name, boolean active) {
		this.code = code;
		this.name = name;
		this.active = active;
	}

	public UUID getId() {
		return id;
	}

	public UUID getTenantId() {
		return tenantId;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public boolean isActive() {
		return active;
	}
}
