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

import com.returnflow.tenant.Tenant;

/**
 * Immutable metadata for a signature a return may have — binary bytes (a
 * server-generated SVG, never client-supplied) live outside PostgreSQL
 * behind {@code storage.ReturnMediaStorage}, mirroring {@link ReturnPhoto}.
 * No endpoint updates, replaces, or deletes a signature once created, so
 * like {@link ReturnPhoto} this does not extend {@code common.audit.Auditable}
 * — {@code signedAt} is the one meaningful timestamp.
 *
 * <p>{@code signatureType} distinguishes the customer signature (Phase 5B)
 * from the warehouse signature (Phase 7A) — the same entity, service
 * validation, and {@link SvgSignatureRenderer} are reused for both rather
 * than duplicating a near-identical warehouse-only type, per root
 * {@code CLAUDE.md} §13.1. Exactly zero or one row exists per
 * ({@link ReturnRecord}, {@code signatureType}) pair, enforced by the
 * {@code uk_return_signature_return_record_type} unique constraint (V13) as
 * the final backstop beneath each caller's own existence check inside the
 * same pessimistic-locked transaction used for photo uploads.
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

	@Enumerated(EnumType.STRING)
	@Column(name = "signature_type", nullable = false, updatable = false, length = 20)
	private SignatureType signatureType;

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

	ReturnSignature(Tenant tenant, ReturnRecord returnRecord, SignatureType signatureType, String signerName,
			String storageKey, String contentType, int sizeBytes) {
		this.tenant = tenant;
		this.returnRecord = returnRecord;
		this.signatureType = signatureType;
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

	SignatureType getSignatureType() {
		return signatureType;
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
