package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.returnflow.returnrecord.dto.AdminReturnDetailResponse;
import com.returnflow.returnrecord.dto.AdminReturnListItemResponse;
import com.returnflow.returnrecord.dto.AdminSummaryResponse;
import com.returnflow.returnrecord.dto.DriverSummaryResponse;
import com.returnflow.returnrecord.dto.ReturnPhotoResponse;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;
import com.returnflow.route.Route;
import com.returnflow.route.dto.RouteSummaryResponse;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;

/**
 * The single place a {@link ReturnRecord} becomes an ADMIN-facing response —
 * shared by the read-only {@link AdminReturnService} (Phase 6A) and the
 * mutating {@code AdminReturnReviewService} (Phase 7A), which returns the
 * same {@link AdminReturnDetailResponse} shape after every lifecycle
 * transition. Centralizing this avoids two independently-maintained copies
 * of the same photo/signature/reviewer-name mapping logic.
 */
@Component
class AdminReturnMapper {

	private final ReturnPhotoRepository returnPhotoRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final UserRepository userRepository;

	AdminReturnMapper(ReturnPhotoRepository returnPhotoRepository, ReturnSignatureRepository returnSignatureRepository,
			UserRepository userRepository) {
		this.returnPhotoRepository = returnPhotoRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.userRepository = userRepository;
	}

	AdminReturnListItemResponse toListItem(ReturnRecord returnRecord, UUID tenantId) {
		int photoCount = returnPhotoRepository.countByReturnRecordId(returnRecord.getId());
		boolean hasSignature = returnSignatureRepository.existsByReturnRecordIdAndSignatureType(returnRecord.getId(), SignatureType.CUSTOMER);
		User driver = returnRecord.getDriver();
		Route route = returnRecord.getRoute();
		return new AdminReturnListItemResponse(
				returnRecord.getId(),
				returnRecord.getReturnNumber(),
				returnRecord.getCustomerName(),
				returnRecord.getProductName(),
				returnRecord.getQuantity(),
				returnRecord.getUnit(),
				returnRecord.getReason(),
				returnRecord.getStatus(),
				new DriverSummaryResponse(driver.getId(), driver.getFullName()),
				new RouteSummaryResponse(route.getId(), route.getCode(), route.getName(), route.isActive()),
				adminSummary(returnRecord.getReviewStartedBy(), tenantId),
				returnRecord.getCreatedAt(),
				photoCount,
				hasSignature);
	}

	AdminReturnDetailResponse toDetail(ReturnRecord returnRecord, UUID tenantId) {
		User driver = returnRecord.getDriver();
		Route route = returnRecord.getRoute();
		List<ReturnPhotoResponse> photos = returnPhotoRepository
				.findByReturnRecordIdAndTenantIdOrderByPositionAsc(returnRecord.getId(), tenantId)
				.stream().map(photo -> toAdminPhotoResponse(returnRecord.getId(), photo)).toList();
		ReturnSignatureResponse signature = returnSignatureRepository
				.findByReturnRecordIdAndTenantIdAndSignatureType(returnRecord.getId(), tenantId, SignatureType.CUSTOMER)
				.map(sig -> toAdminSignatureResponse(returnRecord.getId(), sig, "signature"))
				.orElse(null);
		ReturnSignature warehouseSignatureEntity = returnSignatureRepository
				.findByReturnRecordIdAndTenantIdAndSignatureType(returnRecord.getId(), tenantId, SignatureType.WAREHOUSE)
				.orElse(null);
		ReturnSignatureResponse warehouseSignature = warehouseSignatureEntity == null ? null
				: toAdminSignatureResponse(returnRecord.getId(), warehouseSignatureEntity, "warehouse-signature");
		String warehouseRepresentativeName = warehouseSignatureEntity == null ? null : warehouseSignatureEntity.getSignerName();

		return new AdminReturnDetailResponse(
				returnRecord.getId(),
				returnRecord.getReturnNumber(),
				returnRecord.getStatus(),
				returnRecord.getCustomerName(),
				returnRecord.getProductName(),
				returnRecord.getQuantity(),
				returnRecord.getUnit(),
				returnRecord.getReason(),
				returnRecord.getReasonDetails(),
				returnRecord.getObservation(),
				new DriverSummaryResponse(driver.getId(), driver.getFullName()),
				new RouteSummaryResponse(route.getId(), route.getCode(), route.getName(), route.isActive()),
				photos,
				signature,
				adminSummary(returnRecord.getReviewStartedBy(), tenantId),
				returnRecord.getReviewStartedAt(),
				returnRecord.getSellable(),
				returnRecord.getCreditCustomer(),
				returnRecord.getChargeCustomer(),
				returnRecord.getChargeDriver(),
				returnRecord.getWarehouseObservation(),
				warehouseRepresentativeName,
				warehouseSignature,
				adminSummary(returnRecord.getClosedBy(), tenantId),
				returnRecord.getClosedAt(),
				adminSummary(returnRecord.getCancelledBy(), tenantId),
				returnRecord.getCancelledAt(),
				returnRecord.getCancellationReason(),
				returnRecord.getCreatedAt(),
				returnRecord.getUpdatedAt());
	}

	/** {@code null} when the return has no such actor (e.g. no reviewer yet) — clients derive that from the nullability, matching the rest of this API's convention. */
	AdminSummaryResponse adminSummary(UUID adminId, UUID tenantId) {
		if (adminId == null) {
			return null;
		}
		return userRepository.findByIdAndTenantId(adminId, tenantId)
				.map(admin -> new AdminSummaryResponse(admin.getId(), admin.getFullName()))
				.orElse(null);
	}

	/** ADMIN-scoped content path — deliberately not {@code ReturnPhotoService.toResponse}, which hardcodes the DRIVER-only path. */
	private static ReturnPhotoResponse toAdminPhotoResponse(UUID returnId, ReturnPhoto photo) {
		String contentPath = "/api/v1/admin/returns/%s/photos/%s/content".formatted(returnId, photo.getId());
		return new ReturnPhotoResponse(photo.getId(), photo.getContentType(), photo.getSizeBytes(), photo.getPosition(), contentPath, photo.getCreatedAt());
	}

	/** ADMIN-scoped content path — deliberately not {@code ReturnSignatureService.toResponse}, which hardcodes the DRIVER-only path. {@code pathSegment} is {@code "signature"} or {@code "warehouse-signature"}. */
	private static ReturnSignatureResponse toAdminSignatureResponse(UUID returnId, ReturnSignature signature, String pathSegment) {
		String contentPath = "/api/v1/admin/returns/%s/%s/content".formatted(returnId, pathSegment);
		return new ReturnSignatureResponse(signature.getId(), signature.getSignerName(), signature.getContentType(),
				signature.getSizeBytes(), contentPath, signature.getSignedAt());
	}
}
