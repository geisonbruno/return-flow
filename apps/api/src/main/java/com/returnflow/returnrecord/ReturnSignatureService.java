package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.CreateReturnSignatureRequest;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;
import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;

/**
 * Orchestrates the one-signature-per-return workflow, mirroring
 * {@link ReturnPhotoService}'s conventions: tenant scoping always from
 * {@link TenantContext}, driver identity always from the authenticated
 * principal.
 */
@Service
class ReturnSignatureService {

	private static final String SVG_CONTENT_TYPE = "image/svg+xml";

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final ReturnMediaStorage returnMediaStorage;
	private final SvgSignatureRenderer svgSignatureRenderer;

	ReturnSignatureService(ReturnRecordRepository returnRecordRepository, ReturnSignatureRepository returnSignatureRepository,
			ReturnMediaStorage returnMediaStorage, SvgSignatureRenderer svgSignatureRenderer) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.returnMediaStorage = returnMediaStorage;
		this.svgSignatureRenderer = svgSignatureRenderer;
	}

	@Transactional
	ReturnSignatureResponse create(UUID returnId, CreateReturnSignatureRequest request, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		// Same row lock ReturnPhotoService uses before assigning a photo
		// position: held for this whole transaction, so a concurrent
		// signature submission for THIS SAME return can't also observe "no
		// signature yet" and insert a second one. Submissions to different
		// returns never block each other.
		ReturnRecord returnRecord = returnRecordRepository
				.findByIdAndTenantIdAndDriverIdForUpdate(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);
		if (returnRecord.getStatus() != ReturnStatus.AWAITING_WAREHOUSE) {
			throw new ReturnNotEditableException();
		}

		if (returnSignatureRepository.existsByReturnRecordIdAndSignatureType(returnRecord.getId(), SignatureType.CUSTOMER)) {
			throw new SignatureAlreadyExistsException();
		}

		String signerName = SignatureStrokeValidator.validateSignerName(request.signerName());
		List<List<NormalizedSignaturePoint>> strokes = SignatureStrokeValidator.validateStrokes(request.strokes());

		byte[] svg = svgSignatureRenderer.render(strokes);
		String storageKey = generateStorageKey(tenantId, returnRecord.getId());
		returnMediaStorage.store(storageKey, svg);

		ReturnSignature signature = new ReturnSignature(returnRecord.getTenant(), returnRecord, SignatureType.CUSTOMER,
				signerName, storageKey, SVG_CONTENT_TYPE, svg.length);
		ReturnSignature saved = returnSignatureRepository.save(signature);
		return toResponse(returnRecord.getId(), saved);
	}

	@Transactional(readOnly = true)
	ReturnSignatureResponse get(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		ReturnSignature signature = returnSignatureRepository
				.findByReturnRecordIdAndTenantIdAndSignatureType(returnRecord.getId(), tenantId, SignatureType.CUSTOMER)
				.orElseThrow(ReturnSignatureNotFoundException::new);
		return toResponse(returnRecord.getId(), signature);
	}

	@Transactional(readOnly = true)
	SignatureContent content(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		ReturnSignature signature = returnSignatureRepository
				.findByReturnRecordIdAndTenantIdAndSignatureType(returnRecord.getId(), tenantId, SignatureType.CUSTOMER)
				.orElseThrow(ReturnSignatureNotFoundException::new);
		byte[] bytes = returnMediaStorage.read(signature.getStorageKey());
		return new SignatureContent(bytes, signature.getContentType());
	}

	private ReturnRecord requireOwnedReturn(UUID returnId, UUID tenantId, AuthenticatedPrincipal principal) {
		return returnRecordRepository.findByIdAndTenantIdAndDriverId(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);
	}

	/** Matches the key shape already documented in apps/api/CLAUDE.md's "Files and signatures" section. */
	private static String generateStorageKey(UUID tenantId, UUID returnId) {
		return "tenants/%s/returns/%s/signatures/customer/%s.svg".formatted(tenantId, returnId, UUID.randomUUID());
	}

	/** Package-visible so {@link DriverReturnService} can reuse the exact same safe mapping when embedding the signature in {@code ReturnResponse}. */
	static ReturnSignatureResponse toResponse(UUID returnId, ReturnSignature signature) {
		String contentPath = "/api/v1/driver/returns/%s/signature/content".formatted(returnId);
		return new ReturnSignatureResponse(signature.getId(), signature.getSignerName(), signature.getContentType(),
				signature.getSizeBytes(), contentPath, signature.getSignedAt());
	}

	record SignatureContent(byte[] bytes, String contentType) {
	}
}
