package com.returnflow.returnrecord;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.ReturnPhotoResponse;
import com.returnflow.storage.ReturnMediaStorage;
import com.returnflow.tenant.TenantContext;

/**
 * Orchestrates return-photo upload/list/content, mirroring
 * {@link DriverReturnService}'s conventions: tenant scoping always from
 * {@link TenantContext}, driver identity always from the authenticated
 * principal, never from client-supplied data.
 */
@Service
class ReturnPhotoService {

	private static final int MAX_PHOTOS_PER_RETURN = 5;
	private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
	private static final String JPEG_CONTENT_TYPE = "image/jpeg";
	private static final byte[] JPEG_MAGIC = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnPhotoRepository returnPhotoRepository;
	private final ReturnMediaStorage returnMediaStorage;

	ReturnPhotoService(ReturnRecordRepository returnRecordRepository, ReturnPhotoRepository returnPhotoRepository,
			ReturnMediaStorage returnMediaStorage) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnPhotoRepository = returnPhotoRepository;
		this.returnMediaStorage = returnMediaStorage;
	}

	@Transactional
	ReturnPhotoResponse upload(UUID returnId, MultipartFile file, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		// Row lock held for this whole transaction: a concurrent upload to
		// THIS SAME return can't also read "4 photos" and insert position 5
		// — see ReturnRecordRepository.findByIdAndTenantIdAndDriverIdForUpdate's
		// Javadoc. Uploads to different returns never block each other.
		ReturnRecord returnRecord = returnRecordRepository
				.findByIdAndTenantIdAndDriverIdForUpdate(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);

		byte[] content = readAndValidate(file);

		int existingCount = returnPhotoRepository.countByReturnRecordId(returnRecord.getId());
		if (existingCount >= MAX_PHOTOS_PER_RETURN) {
			throw new PhotoLimitExceededException();
		}
		int position = existingCount + 1;

		String storageKey = generateStorageKey(tenantId, returnRecord.getId());
		returnMediaStorage.store(storageKey, content);

		ReturnPhoto photo = new ReturnPhoto(returnRecord.getTenant(), returnRecord, storageKey, JPEG_CONTENT_TYPE,
				content.length, position);
		ReturnPhoto saved = returnPhotoRepository.save(photo);
		return toResponse(returnRecord.getId(), saved);
	}

	@Transactional(readOnly = true)
	List<ReturnPhotoResponse> list(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		return returnPhotoRepository.findByReturnRecordIdAndTenantIdOrderByPositionAsc(returnRecord.getId(), tenantId)
				.stream().map(photo -> toResponse(returnRecord.getId(), photo)).toList();
	}

	@Transactional(readOnly = true)
	PhotoContent content(UUID returnId, UUID photoId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = requireOwnedReturn(returnId, tenantId, principal);
		ReturnPhoto photo = returnPhotoRepository.findByIdAndReturnRecordIdAndTenantId(photoId, returnRecord.getId(), tenantId)
				.orElseThrow(ReturnPhotoNotFoundException::new);
		byte[] bytes = returnMediaStorage.read(photo.getStorageKey());
		return new PhotoContent(bytes, photo.getContentType());
	}

	private ReturnRecord requireOwnedReturn(UUID returnId, UUID tenantId, AuthenticatedPrincipal principal) {
		return returnRecordRepository.findByIdAndTenantIdAndDriverId(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);
	}

	private static byte[] readAndValidate(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new InvalidPhotoFileException();
		}
		if (file.getSize() > MAX_FILE_SIZE_BYTES) {
			throw new InvalidPhotoFileException();
		}
		String contentType = file.getContentType();
		if (contentType == null || !contentType.equalsIgnoreCase(JPEG_CONTENT_TYPE)) {
			throw new InvalidPhotoFileException();
		}
		byte[] content;
		try {
			content = file.getBytes();
		} catch (IOException e) {
			throw new InvalidPhotoFileException();
		}
		if (content.length == 0 || content.length > MAX_FILE_SIZE_BYTES || !looksLikeJpeg(content)) {
			throw new InvalidPhotoFileException();
		}
		return content;
	}

	/** A client-declared Content-Type header alone can be spoofed, so this also sniffs the real JPEG magic bytes (FF D8 FF). */
	private static boolean looksLikeJpeg(byte[] content) {
		if (content.length < JPEG_MAGIC.length) {
			return false;
		}
		for (int i = 0; i < JPEG_MAGIC.length; i++) {
			if (content[i] != JPEG_MAGIC[i]) {
				return false;
			}
		}
		return true;
	}

	/** Matches the key shape already documented in apps/api/CLAUDE.md's "Files and signatures" section. */
	private static String generateStorageKey(UUID tenantId, UUID returnId) {
		return "tenants/%s/returns/%s/photos/%s.jpg".formatted(tenantId, returnId, UUID.randomUUID());
	}

	/** Package-visible so {@link DriverReturnService} can reuse the exact same safe mapping when embedding photos in {@code ReturnResponse}. */
	static ReturnPhotoResponse toResponse(UUID returnId, ReturnPhoto photo) {
		String contentPath = "/api/v1/driver/returns/%s/photos/%s/content".formatted(returnId, photo.getId());
		return new ReturnPhotoResponse(photo.getId(), photo.getContentType(), photo.getSizeBytes(), photo.getPosition(),
				contentPath, photo.getCreatedAt());
	}

	record PhotoContent(byte[] bytes, String contentType) {
	}
}
