package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.AdminReturnDetailResponse;
import com.returnflow.returnrecord.dto.CancelReturnRequest;
import com.returnflow.returnrecord.dto.CloseReturnRequest;
import com.returnflow.returnrecord.dto.TakeOverReviewRequest;
import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;

/**
 * Orchestrates the complete server-authoritative warehouse-review lifecycle
 * (Phase 7A) — Start Review, Release Review, Take Over Review, Close, and
 * Cancel. Every method locks the target return for the whole transaction via
 * {@link ReturnRecordRepository#findByIdAndTenantIdForUpdate}, the same
 * "serialize concurrent mutation of one return" pattern
 * {@code ReturnPhotoService}/{@code ReturnSignatureService} already use, so
 * two concurrent lifecycle requests on the same return can never both
 * observe the pre-transition status and both "win." Tenant scoping always
 * comes from {@link TenantContext}; reviewer/closer/canceller identity
 * always comes from the authenticated principal — never client-supplied
 * data, per root {@code CLAUDE.md} §21.1/§25.
 */
@Service
class AdminReturnReviewService {

	private static final String SVG_CONTENT_TYPE = "image/svg+xml";

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final ReturnMediaStorage returnMediaStorage;
	private final SvgSignatureRenderer svgSignatureRenderer;
	private final AdminReturnMapper adminReturnMapper;

	AdminReturnReviewService(ReturnRecordRepository returnRecordRepository, ReturnSignatureRepository returnSignatureRepository,
			ReturnMediaStorage returnMediaStorage, SvgSignatureRenderer svgSignatureRenderer, AdminReturnMapper adminReturnMapper) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.returnMediaStorage = returnMediaStorage;
		this.svgSignatureRenderer = svgSignatureRenderer;
		this.adminReturnMapper = adminReturnMapper;
	}

	@Transactional
	AdminReturnDetailResponse startReview(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = lockOwnedReturn(returnId, tenantId);

		if (returnRecord.getStatus() == ReturnStatus.IN_REVIEW) {
			throw new ReviewAlreadyClaimedException(reviewerName(returnRecord, tenantId));
		}
		if (returnRecord.getStatus() != ReturnStatus.AWAITING_WAREHOUSE) {
			throw new InvalidReturnLifecycleException("Return must be waiting for warehouse review to start a review.");
		}

		returnRecord.startReview(principal.userId());
		return adminReturnMapper.toDetail(returnRecord, tenantId);
	}

	@Transactional
	AdminReturnDetailResponse releaseReview(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = lockOwnedReturn(returnId, tenantId);

		requireInReview(returnRecord);
		requireCurrentOwner(returnRecord, tenantId, principal);

		returnRecord.releaseReview();
		return adminReturnMapper.toDetail(returnRecord, tenantId);
	}

	@Transactional
	AdminReturnDetailResponse takeOverReview(UUID returnId, TakeOverReviewRequest request, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = lockOwnedReturn(returnId, tenantId);

		requireInReview(returnRecord);
		if (!request.expectedCurrentReviewerId().equals(returnRecord.getReviewStartedBy())) {
			throw new StaleTakeoverException(reviewerName(returnRecord, tenantId));
		}

		returnRecord.takeOverReview(principal.userId());
		return adminReturnMapper.toDetail(returnRecord, tenantId);
	}

	@Transactional
	AdminReturnDetailResponse close(UUID returnId, CloseReturnRequest request, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = lockOwnedReturn(returnId, tenantId);

		requireInReview(returnRecord);
		requireCurrentOwner(returnRecord, tenantId, principal);

		String warehouseRepresentativeName = SignatureStrokeValidator.validateSignerName(request.warehouseRepresentativeName());
		List<List<NormalizedSignaturePoint>> strokes = SignatureStrokeValidator.validateStrokes(request.warehouseSignatureStrokes());
		String warehouseObservation = normalizeOptionalObservation(request.warehouseObservation());

		byte[] svg = svgSignatureRenderer.render(strokes);
		String storageKey = generateWarehouseSignatureStorageKey(tenantId, returnRecord.getId());
		returnMediaStorage.store(storageKey, svg);

		ReturnSignature warehouseSignature = new ReturnSignature(returnRecord.getTenant(), returnRecord, SignatureType.WAREHOUSE,
				warehouseRepresentativeName, storageKey, SVG_CONTENT_TYPE, svg.length);
		returnSignatureRepository.save(warehouseSignature);

		returnRecord.close(request.sellable(), request.creditCustomer(), request.chargeCustomer(), request.chargeDriver(),
				warehouseObservation, principal.userId());
		return adminReturnMapper.toDetail(returnRecord, tenantId);
	}

	@Transactional
	AdminReturnDetailResponse cancel(UUID returnId, CancelReturnRequest request, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = lockOwnedReturn(returnId, tenantId);

		if (returnRecord.getStatus() != ReturnStatus.AWAITING_WAREHOUSE && returnRecord.getStatus() != ReturnStatus.IN_REVIEW) {
			throw new InvalidReturnLifecycleException("Return cannot be cancelled from its current status.");
		}

		returnRecord.cancel(principal.userId(), request.reason().trim());
		return adminReturnMapper.toDetail(returnRecord, tenantId);
	}

	private ReturnRecord lockOwnedReturn(UUID returnId, UUID tenantId) {
		return returnRecordRepository.findByIdAndTenantIdForUpdate(returnId, tenantId)
				.orElseThrow(ReturnRecordNotFoundException::new);
	}

	private static void requireInReview(ReturnRecord returnRecord) {
		if (returnRecord.getStatus() != ReturnStatus.IN_REVIEW) {
			throw new InvalidReturnLifecycleException("Return is not currently under warehouse review.");
		}
	}

	private void requireCurrentOwner(ReturnRecord returnRecord, UUID tenantId, AuthenticatedPrincipal principal) {
		if (!principal.userId().equals(returnRecord.getReviewStartedBy())) {
			throw new ReviewOwnershipConflictException(reviewerName(returnRecord, tenantId));
		}
	}

	/** {@code null} in the (unreachable through normal use) case where the reviewer row can no longer be resolved — no endpoint deletes users. */
	private String reviewerName(ReturnRecord returnRecord, UUID tenantId) {
		var reviewer = adminReturnMapper.adminSummary(returnRecord.getReviewStartedBy(), tenantId);
		return reviewer == null ? null : reviewer.fullName();
	}

	private static String normalizeOptionalObservation(String rawObservation) {
		String trimmed = rawObservation == null ? null : rawObservation.trim();
		return trimmed == null || trimmed.isEmpty() ? null : trimmed;
	}

	/** Matches the key shape already documented in apps/api/CLAUDE.md's "Files and signatures" section. */
	private static String generateWarehouseSignatureStorageKey(UUID tenantId, UUID returnId) {
		return "tenants/%s/returns/%s/signatures/warehouse/%s.svg".formatted(tenantId, returnId, UUID.randomUUID());
	}
}
