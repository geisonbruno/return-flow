package com.returnflow.returnrecord;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import com.returnflow.tenant.Tenant;

/**
 * Immutable metadata for one uploaded return photo — binary bytes live
 * outside PostgreSQL, behind {@code storage.ReturnMediaStorage}; only
 * {@code storageKey} (a server-generated object key, never a client
 * filename) is stored here. No Phase 5A endpoint updates or deletes a photo
 * once created, so unlike {@link ReturnRecord} this entity does not extend
 * {@code common.audit.Auditable} — there is no meaningful {@code updatedAt}
 * for a row that never changes, so only {@code createdAt} exists.
 *
 * <p>{@code position} maps to the {@code photo_position} column, not
 * {@code position} — {@code POSITION} is a reserved SQL keyword/function in
 * PostgreSQL, so the physical column avoids it entirely rather than relying
 * on quoting rules (the same deliberate Java/DB name split already used by
 * {@code ReturnRecord.reasonDetails}/{@code other_reason_details}).
 */
@Entity
@Table(name = "return_photo")
public class ReturnPhoto {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tenant_id", nullable = false)
	private Tenant tenant;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "return_record_id", nullable = false)
	private ReturnRecord returnRecord;

	@Column(name = "storage_key", nullable = false, unique = true, updatable = false, length = 300)
	private String storageKey;

	@Column(name = "content_type", nullable = false, updatable = false, length = 50)
	private String contentType;

	@Column(name = "size_bytes", nullable = false, updatable = false)
	private int sizeBytes;

	@Column(name = "photo_position", nullable = false, updatable = false)
	private int position;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected ReturnPhoto() {
		// JPA
	}

	ReturnPhoto(Tenant tenant, ReturnRecord returnRecord, String storageKey, String contentType, int sizeBytes, int position) {
		this.tenant = tenant;
		this.returnRecord = returnRecord;
		this.storageKey = storageKey;
		this.contentType = contentType;
		this.sizeBytes = sizeBytes;
		this.position = position;
		this.createdAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public Tenant getTenant() {
		return tenant;
	}

	public ReturnRecord getReturnRecord() {
		return returnRecord;
	}

	public String getStorageKey() {
		return storageKey;
	}

	public String getContentType() {
		return contentType;
	}

	public int getSizeBytes() {
		return sizeBytes;
	}

	public int getPosition() {
		return position;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
