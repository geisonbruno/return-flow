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
 * Immutable metadata for the one customer signature a return may have —
 * binary bytes (a server-generated SVG, never client-supplied) live outside
 * PostgreSQL behind {@code storage.ReturnMediaStorage}, mirroring
 * {@link ReturnPhoto}. No endpoint updates, replaces, or deletes a signature
 * once created, so like {@link ReturnPhoto} this does not extend
 * {@code common.audit.Auditable} — {@code signedAt} is the one meaningful
 * timestamp.
 *
 * <p>Exactly zero or one row exists per {@link ReturnRecord}, enforced by the
 * {@code uk_return_signature_return_record} unique constraint (V11) as the
 * final backstop beneath {@code ReturnSignatureService}'s existence check
 * inside the same pessimistic-locked transaction used for photo uploads.
 */
@Entity
@Table(name = "return_signature")
public class ReturnSignature {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tenant_id", nullable = false)
	private Tenant tenant;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "return_record_id", nullable = false)
	private ReturnRecord returnRecord;

	@Column(name = "signer_name", nullable = false, updatable = false, length = 100)
	private String signerName;

	@Column(name = "storage_key", nullable = false, unique = true, updatable = false, length = 300)
	private String storageKey;

	@Column(name = "content_type", nullable = false, updatable = false, length = 50)
	private String contentType;

	@Column(name = "size_bytes", nullable = false, updatable = false)
	private int sizeBytes;

	@Column(name = "signed_at", nullable = false, updatable = false)
	private Instant signedAt;

	protected ReturnSignature() {
		// JPA
	}

	ReturnSignature(Tenant tenant, ReturnRecord returnRecord, String signerName, String storageKey, String contentType, int sizeBytes) {
		this.tenant = tenant;
		this.returnRecord = returnRecord;
		this.signerName = signerName;
		this.storageKey = storageKey;
		this.contentType = contentType;
		this.sizeBytes = sizeBytes;
		this.signedAt = Instant.now();
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

	public String getSignerName() {
		return signerName;
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

	public Instant getSignedAt() {
		return signedAt;
	}
}
