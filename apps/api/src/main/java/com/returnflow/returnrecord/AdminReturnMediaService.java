package com.returnflow.returnrecord;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;

/**
 * ADMIN-only authenticated media content access (Phase 6A) — the existing
 * content endpoints under {@code /api/v1/driver/**} require DRIVER role and
 * ownership, so an ADMIN cannot use them. This reuses the exact same
 * tenant-scoped repository lookups {@code ReturnPhotoService}/
 * {@code ReturnSignatureService} already use for the DRIVER endpoints —
 * neither of those lookups checks driver ownership, only tenant — so no
 * repository changes were needed. Read-only: no upload, replace, or delete
 * capability exists here, matching Phase 6A's read-only scope.
 */
@Service
class AdminReturnMediaService {

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnPhotoRepository returnPhotoRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final ReturnMediaStorage returnMediaStorage;

	AdminReturnMediaService(ReturnRecordRepository returnRecordRepository, ReturnPhotoRepository returnPhotoRepository,
			ReturnSignatureRepository returnSignatureRepository, ReturnMediaStorage returnMediaStorage) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnPhotoRepository = returnPhotoRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.returnMediaStorage = returnMediaStorage;
	}

	@Transactional(readOnly = true)
	ReturnPhotoService.PhotoContent photoContent(UUID returnId, UUID photoId) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId);
		ReturnPhoto photo = returnPhotoRepository.findByIdAndReturnRecordIdAndTenantId(photoId, returnRecord.getId(), tenantId)
				.orElseThrow(ReturnPhotoNotFoundException::new);
		byte[] bytes = returnMediaStorage.read(photo.getStorageKey());
		return new ReturnPhotoService.PhotoContent(bytes, photo.getContentType());
	}

	@Transactional(readOnly = true)
	ReturnSignatureService.SignatureContent signatureContent(UUID returnId) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId);
		ReturnSignature signature = returnSignatureRepository.findByReturnRecordIdAndTenantId(returnRecord.getId(), tenantId)
				.orElseThrow(ReturnSignatureNotFoundException::new);
		byte[] bytes = returnMediaStorage.read(signature.getStorageKey());
		return new ReturnSignatureService.SignatureContent(bytes, signature.getContentType());
	}

	private ReturnRecord requireOwnedReturn(UUID returnId, UUID tenantId) {
		return returnRecordRepository.findByIdAndTenantId(returnId, tenantId).orElseThrow(ReturnRecordNotFoundException::new);
	}
}
