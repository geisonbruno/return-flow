package com.returnflow.returnrecord;

import java.time.Instant;
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
import jakarta.persistence.Version;

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
 * at creation and have no mutator — this phase implements no driver
 * update/edit endpoint. The Phase 7A warehouse-review fields below
 * ({@code reviewStartedBy} onward) are mutated only through
 * {@code AdminReturnReviewService}'s dedicated lifecycle methods, each
 * called only after that service has already verified the current status,
 * tenant, and (where relevant) review ownership under a pessimistic row
 * lock (see {@code ReturnRecordRepository.findByIdAndTenantIdForUpdate}) —
 * the same "serialize concurrent mutation of one return" pattern
 * {@code ReturnPhotoService}/{@code ReturnSignatureService} already use for
 * photo/signature uploads. {@code version} is an additional optimistic-lock
 * backstop (root {@code CLAUDE.md} §25) beneath that pessimistic lock, not a
 * replacement for it. Reviewer/closer/canceller are stored as raw
 * {@code UUID} columns, not {@code @ManyToOne} associations — unlike
 * {@code tenant}/{@code driver}/{@code route} above, these are optional,
 * populated well after creation, and don't need the three-aggregate-roots
 * justification that motivated those associations.
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

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "review_started_by")
	private UUID reviewStartedBy;

	@Column(name = "review_started_at")
	private Instant reviewStartedAt;

	@Column
	private Boolean sellable;

	@Column(name = "credit_customer")
	private Boolean creditCustomer;

	@Column(name = "charge_customer")
	private Boolean chargeCustomer;

	@Column(name = "charge_driver")
	private Boolean chargeDriver;

	@Column(name = "warehouse_observation", length = 2000)
	private String warehouseObservation;

	@Column(name = "closed_by")
	private UUID closedBy;

	@Column(name = "closed_at")
	private Instant closedAt;

	@Column(name = "cancelled_by")
	private UUID cancelledBy;

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancellation_reason", length = 500)
	private String cancellationReason;

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

	public long getVersion() {
		return version;
	}

	public UUID getReviewStartedBy() {
		return reviewStartedBy;
	}

	public Instant getReviewStartedAt() {
		return reviewStartedAt;
	}

	public Boolean getSellable() {
		return sellable;
	}

	public Boolean getCreditCustomer() {
		return creditCustomer;
	}

	public Boolean getChargeCustomer() {
		return chargeCustomer;
	}

	public Boolean getChargeDriver() {
		return chargeDriver;
	}

	public String getWarehouseObservation() {
		return warehouseObservation;
	}

	public UUID getClosedBy() {
		return closedBy;
	}

	public Instant getClosedAt() {
		return closedAt;
	}

	public UUID getCancelledBy() {
		return cancelledBy;
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public String getCancellationReason() {
		return cancellationReason;
	}

	/** Called only by {@code AdminReturnReviewService} after it has already verified the return is {@code AWAITING_WAREHOUSE}. */
	void startReview(UUID adminId) {
		this.status = ReturnStatus.IN_REVIEW;
		this.reviewStartedBy = adminId;
		this.reviewStartedAt = Instant.now();
	}

	/** Called only by {@code AdminReturnReviewService} after it has already verified the caller is the current review owner. No warehouse field is touched — nothing was ever persisted to release. */
	void releaseReview() {
		this.status = ReturnStatus.AWAITING_WAREHOUSE;
		this.reviewStartedBy = null;
		this.reviewStartedAt = null;
	}

	/**
	 * Reassigns review ownership without changing {@code status} (already
	 * {@code IN_REVIEW}). Deliberately the smallest durable audit trail for a
	 * takeover — updating these two fields again, not a separate event/history
	 * table — per this phase's explicit "do not build event sourcing" scope.
	 */
	void takeOverReview(UUID adminId) {
		this.reviewStartedBy = adminId;
		this.reviewStartedAt = Instant.now();
	}

	/** Called only by {@code AdminReturnReviewService} after it has already verified review ownership and validated every required field and the warehouse signature. */
	void close(boolean sellable, boolean creditCustomer, boolean chargeCustomer, boolean chargeDriver,
			String warehouseObservation, UUID adminId) {
		this.status = ReturnStatus.CLOSED;
		this.sellable = sellable;
		this.creditCustomer = creditCustomer;
		this.chargeCustomer = chargeCustomer;
		this.chargeDriver = chargeDriver;
		this.warehouseObservation = warehouseObservation;
		this.closedBy = adminId;
		this.closedAt = Instant.now();
	}

	/** Called only by {@code AdminReturnReviewService} after it has already verified the return is cancellable. Reviewer fields, if set, are left as the historical record of who was reviewing at the time — this is cancellation, not deletion. */
	void cancel(UUID adminId, String reason) {
		this.status = ReturnStatus.CANCELLED;
		this.cancelledBy = adminId;
		this.cancelledAt = Instant.now();
		this.cancellationReason = reason;
	}
}
