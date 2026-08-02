package com.returnflow.returnrecord;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.returnflow.common.audit.Auditable;
import com.returnflow.route.Route;
import com.returnflow.tenant.Tenant;
import com.returnflow.user.User;

/**
 * The central operational record: one customer, one product situation, one
 * reason, one independent lifecycle — never a multi-line shipment (see root
 * CLAUDE.md §8). Unlike every other entity so far, this one holds genuine
 * {@code @ManyToOne(fetch = LAZY)} associations to {@code Tenant}/{@code User}
 * (driver)/{@code Route} rather than raw UUID columns — a deliberate,
 * explicitly-requested exception to this codebase's usual
 * store-the-raw-tenant-id convention, justified by this entity uniquely
 * referencing three different aggregate roots at once. The relationships are
 * strictly unidirectional: none of {@code Tenant}, {@code User}, or
 * {@code Route} gained a back-reference collection, and nothing here
 * cascades to them.
 *
 * <p>{@code route} is the driver's route <em>at creation time</em>, not a
 * live derivation from the driver's current assignment — seeded once by
 * {@link ReturnRecordCreator} and never updated afterward, so a later route
 * reassignment never rewrites history (see that class's Javadoc).
 *
 * <p>{@code quantity}, {@code unit}, and {@code reasonDetails} are set once
 * at creation and, like every other field here, have no mutator — this
 * phase implements no update/edit endpoint.
 */
@Entity
@Table(name = "return_record")
public class ReturnRecord extends Auditable {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tenant_id", nullable = false)
	private Tenant tenant;

	@Column(name = "return_number", nullable = false, unique = true, updatable = false, length = 32)
	private String returnNumber;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "driver_id", nullable = false)
	private User driver;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "route_id", nullable = false)
	private Route route;

	@Column(name = "customer_name", nullable = false, length = 200)
	private String customerName;

	@Column(name = "product_name", nullable = false, length = 200)
	private String productName;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private ReturnReason reason;

	// Column name intentionally differs from the Java/API property name: V8
	// already created "other_reason_details" and this correction phase was
	// explicitly told not to add a migration merely to rename it. The
	// physical name is an internal implementation detail; "reasonDetails" is
	// the public/API-facing name (root CLAUDE.md §10.1).
	@Column(name = "other_reason_details", length = 500)
	private String reasonDetails;

	@Column(nullable = false)
	private int quantity;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private ReturnUnit unit;

	@Column(nullable = false, length = 2000)
	private String observation;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 30)
	private ReturnStatus status;

	protected ReturnRecord() {
		// JPA
	}

	ReturnRecord(Tenant tenant, String returnNumber, User driver, Route route, String customerName, String productName,
			ReturnReason reason, String reasonDetails, int quantity, ReturnUnit unit, String observation, ReturnStatus status) {
		this.tenant = tenant;
		this.returnNumber = returnNumber;
		this.driver = driver;
		this.route = route;
		this.customerName = customerName;
		this.productName = productName;
		this.reason = reason;
		this.reasonDetails = reasonDetails;
		this.quantity = quantity;
		this.unit = unit;
		this.observation = observation;
		this.status = status;
	}

	public UUID getId() {
		return id;
	}

	public Tenant getTenant() {
		return tenant;
	}

	public String getReturnNumber() {
		return returnNumber;
	}

	public User getDriver() {
		return driver;
	}

	public Route getRoute() {
		return route;
	}

	public String getCustomerName() {
		return customerName;
	}

	public String getProductName() {
		return productName;
	}

	public ReturnReason getReason() {
		return reason;
	}

	public String getReasonDetails() {
		return reasonDetails;
	}

	public int getQuantity() {
		return quantity;
	}

	public ReturnUnit getUnit() {
		return unit;
	}

	public String getObservation() {
		return observation;
	}

	public ReturnStatus getStatus() {
		return status;
	}
}
