package com.returnflow.returnrecord;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.common.web.PageResponse;
import com.returnflow.returnrecord.dto.AdminReturnDetailResponse;
import com.returnflow.returnrecord.dto.AdminReturnListItemResponse;
import com.returnflow.returnrecord.dto.AdminReturnSummaryResponse;
import com.returnflow.returnrecord.dto.DriverSummaryResponse;
import com.returnflow.returnrecord.dto.ReturnPhotoResponse;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;
import com.returnflow.route.Route;
import com.returnflow.route.dto.RouteSummaryResponse;
import com.returnflow.tenant.TenantContext;
import com.returnflow.user.User;

/**
 * Read-only ADMIN return queries (Phase 6A) — tenant scoping always from
 * {@link TenantContext}, mirroring every other ADMIN/DRIVER service in this
 * codebase. No mutation of any kind: Phase 6A ships no Start Review, Close,
 * Cancel, or any other write endpoint (Phase 7A).
 */
@Service
class AdminReturnService {

	private static final int MAX_PAGE_SIZE = 100;
	private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));

	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnPhotoRepository returnPhotoRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final OperationalDayService operationalDayService;

	AdminReturnService(ReturnRecordRepository returnRecordRepository, ReturnPhotoRepository returnPhotoRepository,
			ReturnSignatureRepository returnSignatureRepository, OperationalDayService operationalDayService) {
		this.returnRecordRepository = returnRecordRepository;
		this.returnPhotoRepository = returnPhotoRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.operationalDayService = operationalDayService;
	}

	/**
	 * {@code inReview} and {@code closedToday} are always {@code 0} — see
	 * {@link AdminReturnSummaryResponse}'s Javadoc. Only {@code waitingWarehouse}
	 * and {@code returnsToday} reflect real domain data today.
	 */
	@Transactional(readOnly = true)
	AdminReturnSummaryResponse summary() {
		UUID tenantId = TenantContext.get().getId();
		long waitingWarehouse = returnRecordRepository.countByTenantIdAndStatus(tenantId, ReturnStatus.AWAITING_WAREHOUSE);
		long returnsToday = returnRecordRepository.countByTenantIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
				tenantId, operationalDayService.startOfToday(), operationalDayService.endOfToday());
		return new AdminReturnSummaryResponse((int) waitingWarehouse, 0, 0, (int) returnsToday);
	}

	@Transactional(readOnly = true)
	PageResponse<AdminReturnListItemResponse> list(AdminReturnListQuery query) {
		UUID tenantId = TenantContext.get().getId();
		validatePage(query);
		ReturnStatus status = parseStatus(query.status());
		ReturnReason reason = parseReason(query.reason());
		LocalDate fromDate = parseDate(query.createdFrom());
		LocalDate toDate = parseDate(query.createdTo());
		if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
			throw new InvalidReturnFilterException();
		}
		Instant createdFrom = fromDate == null ? null : operationalDayService.startOfDay(fromDate);
		// toDate is inclusive as a calendar date but exclusive as an instant
		// boundary: a return dated on toDate itself must still match, so the
		// real upper bound is the start of the *next* day.
		Instant createdToExclusive = toDate == null ? null : operationalDayService.startOfDay(toDate.plusDays(1));

		Specification<ReturnRecord> spec = combine(
				ReturnRecordSpecifications.forTenant(tenantId),
				ReturnRecordSpecifications.hasStatus(status),
				ReturnRecordSpecifications.hasReason(reason),
				ReturnRecordSpecifications.createdBetween(createdFrom, createdToExclusive),
				ReturnRecordSpecifications.hasDriver(query.driverId()),
				ReturnRecordSpecifications.hasRoute(query.routeId()),
				ReturnRecordSpecifications.matchesSearch(query.search()));

		Pageable pageable = PageRequest.of(query.page(), query.size(), DEFAULT_SORT);
		org.springframework.data.domain.Page<ReturnRecord> page = returnRecordRepository.findAll(spec, pageable);
		List<AdminReturnListItemResponse> content = page.getContent().stream().map(this::toListItem).toList();
		return new PageResponse<>(content, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
	}

	@Transactional(readOnly = true)
	AdminReturnDetailResponse get(UUID returnId) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = returnRecordRepository.findByIdAndTenantId(returnId, tenantId)
				.orElseThrow(ReturnRecordNotFoundException::new);
		return toDetail(returnRecord, tenantId);
	}

	/**
	 * Combines only the non-null specifications with {@code .and(...)}. Spring
	 * Data JPA 4.1's {@code Specification.and(Specification)} throws
	 * {@code IllegalArgumentException} on a {@code null} argument (unlike
	 * older Spring Data JPA versions, where {@code null} was a documented
	 * no-op) — found via a real failing integration-test run. Filtering
	 * "not applicable" filters out here, rather than relying on {@code .and(null)}
	 * being tolerated, keeps {@link ReturnRecordSpecifications}'s individual
	 * builders free to return {@code null} for "no predicate needed," which
	 * is the simplest way to express an optional filter.
	 */
	@SafeVarargs
	private static Specification<ReturnRecord> combine(Specification<ReturnRecord>... specifications) {
		List<Specification<ReturnRecord>> nonNull = new ArrayList<>();
		for (Specification<ReturnRecord> specification : specifications) {
			if (specification != null) {
				nonNull.add(specification);
			}
		}
		Specification<ReturnRecord> combined = nonNull.get(0);
		for (int i = 1; i < nonNull.size(); i++) {
			combined = combined.and(nonNull.get(i));
		}
		return combined;
	}

	private void validatePage(AdminReturnListQuery query) {
		if (query.page() < 0) {
			throw new InvalidPageRequestException();
		}
		if (query.size() < 1 || query.size() > MAX_PAGE_SIZE) {
			throw new InvalidPageRequestException();
		}
	}

	private static ReturnStatus parseStatus(String raw) {
		if (raw == null) {
			return null;
		}
		try {
			return ReturnStatus.valueOf(raw);
		} catch (IllegalArgumentException e) {
			throw new InvalidReturnFilterException();
		}
	}

	private static ReturnReason parseReason(String raw) {
		if (raw == null) {
			return null;
		}
		try {
			return ReturnReason.valueOf(raw);
		} catch (IllegalArgumentException e) {
			throw new InvalidReturnFilterException();
		}
	}

	private LocalDate parseDate(String raw) {
		if (raw == null) {
			return null;
		}
		try {
			return LocalDate.parse(raw);
		} catch (DateTimeParseException e) {
			throw new InvalidReturnFilterException();
		}
	}

	private AdminReturnListItemResponse toListItem(ReturnRecord returnRecord) {
		int photoCount = returnPhotoRepository.countByReturnRecordId(returnRecord.getId());
		boolean hasSignature = returnSignatureRepository.existsByReturnRecordId(returnRecord.getId());
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
				returnRecord.getCreatedAt(),
				photoCount,
				hasSignature);
	}

	private AdminReturnDetailResponse toDetail(ReturnRecord returnRecord, UUID tenantId) {
		User driver = returnRecord.getDriver();
		Route route = returnRecord.getRoute();
		List<ReturnPhotoResponse> photos = returnPhotoRepository
				.findByReturnRecordIdAndTenantIdOrderByPositionAsc(returnRecord.getId(), tenantId)
				.stream().map(photo -> toAdminPhotoResponse(returnRecord.getId(), photo)).toList();
		ReturnSignatureResponse signature = returnSignatureRepository
				.findByReturnRecordIdAndTenantId(returnRecord.getId(), tenantId)
				.map(sig -> toAdminSignatureResponse(returnRecord.getId(), sig))
				.orElse(null);
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
				returnRecord.getCreatedAt(),
				returnRecord.getUpdatedAt());
	}

	/** ADMIN-scoped content path — deliberately not {@code ReturnPhotoService.toResponse}, which hardcodes the DRIVER-only path. */
	private static ReturnPhotoResponse toAdminPhotoResponse(UUID returnId, ReturnPhoto photo) {
		String contentPath = "/api/v1/admin/returns/%s/photos/%s/content".formatted(returnId, photo.getId());
		return new ReturnPhotoResponse(photo.getId(), photo.getContentType(), photo.getSizeBytes(), photo.getPosition(), contentPath, photo.getCreatedAt());
	}

	/** ADMIN-scoped content path — deliberately not {@code ReturnSignatureService.toResponse}, which hardcodes the DRIVER-only path. */
	private static ReturnSignatureResponse toAdminSignatureResponse(UUID returnId, ReturnSignature signature) {
		String contentPath = "/api/v1/admin/returns/%s/signature/content".formatted(returnId);
		return new ReturnSignatureResponse(signature.getId(), signature.getSignerName(), signature.getContentType(),
				signature.getSizeBytes(), contentPath, signature.getSignedAt());
	}
}
