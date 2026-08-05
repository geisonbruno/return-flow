package com.returnflow.returnrecord;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.auth.AuthenticatedPrincipal;
import com.returnflow.returnrecord.dto.CreateReturnRequest;
import com.returnflow.returnrecord.dto.DriverSummaryResponse;
import com.returnflow.returnrecord.dto.ReturnPhotoResponse;
import com.returnflow.returnrecord.dto.ReturnResponse;
import com.returnflow.returnrecord.dto.ReturnSignatureResponse;
import com.returnflow.route.Route;
import com.returnflow.route.dto.RouteSummaryResponse;
import com.returnflow.tenant.Tenant;
import com.returnflow.tenant.TenantContext;
import com.returnflow.user.User;
import com.returnflow.user.UserRepository;

/**
 * Orchestrates the driver-facing return API. Tenant scoping comes from
 * {@link TenantContext} — populated by {@code auth.security.JwtAuthenticationFilter}
 * before any request reaches this service — never from client-supplied data.
 * Driver identity likewise always comes from the authenticated principal,
 * never a path or body parameter.
 *
 * <p>{@link #list} and {@link #get} are {@code @Transactional(readOnly = true)}
 * — unlike every read method in {@code route}/{@code user} (whose entities
 * store raw UUID columns, not JPA associations), {@link ReturnRecord}'s
 * {@code driver}/{@code route} associations are {@code fetch = LAZY}. Without
 * an open session spanning the DTO mapping below, accessing them there would
 * throw {@code LazyInitializationException} once the repository call's own
 * short-lived transaction closes (this project runs with
 * {@code spring.jpa.open-in-view=false}).
 */
@Service
class DriverReturnService {

	private final ReturnRecordCreator returnRecordCreator;
	private final ReturnRecordRepository returnRecordRepository;
	private final ReturnPhotoRepository returnPhotoRepository;
	private final ReturnSignatureRepository returnSignatureRepository;
	private final UserRepository userRepository;

	DriverReturnService(ReturnRecordCreator returnRecordCreator, ReturnRecordRepository returnRecordRepository,
			ReturnPhotoRepository returnPhotoRepository, ReturnSignatureRepository returnSignatureRepository,
			UserRepository userRepository) {
		this.returnRecordCreator = returnRecordCreator;
		this.returnRecordRepository = returnRecordRepository;
		this.returnPhotoRepository = returnPhotoRepository;
		this.returnSignatureRepository = returnSignatureRepository;
		this.userRepository = userRepository;
	}

	@Transactional
	ReturnResponse create(CreateReturnRequest request, AuthenticatedPrincipal principal) {
		Tenant tenant = TenantContext.get();
		User driver = findAuthenticatedDriver(principal, tenant);
		ReturnRecordCreator.NewReturn newReturn = new ReturnRecordCreator.NewReturn(request.customerName(),
				request.productName(), request.reason(), request.reasonDetails(), request.quantity(), request.unit(),
				request.observation());
		ReturnRecord created = returnRecordCreator.create(tenant, driver, newReturn);
		// A brand-new return can never already have photos or a signature —
		// no query needed for either.
		return toResponse(created, List.of(), null);
	}

	@Transactional(readOnly = true)
	List<ReturnResponse> list(AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		return returnRecordRepository.findByTenantIdAndDriverIdOrderByCreatedAtDescIdDesc(tenantId, principal.userId())
				.stream()
				.map(returnRecord -> toResponse(returnRecord, photosFor(returnRecord, tenantId), signatureFor(returnRecord, tenantId)))
				.toList();
	}

	@Transactional(readOnly = true)
	ReturnResponse get(UUID returnId, AuthenticatedPrincipal principal) {
		UUID tenantId = TenantContext.get().getId();
		ReturnRecord returnRecord = returnRecordRepository
				.findByIdAndTenantIdAndDriverId(returnId, tenantId, principal.userId())
				.orElseThrow(ReturnRecordNotFoundException::new);
		return toResponse(returnRecord, photosFor(returnRecord, tenantId), signatureFor(returnRecord, tenantId));
	}

	private List<ReturnPhotoResponse> photosFor(ReturnRecord returnRecord, UUID tenantId) {
		return returnPhotoRepository.findByReturnRecordIdAndTenantIdOrderByPositionAsc(returnRecord.getId(), tenantId)
				.stream().map(photo -> ReturnPhotoService.toResponse(returnRecord.getId(), photo)).toList();
	}

	/** {@code null} when the return has no signature yet — see {@link ReturnResponse}'s Javadoc on how clients read that. */
	private ReturnSignatureResponse signatureFor(ReturnRecord returnRecord, UUID tenantId) {
		return returnSignatureRepository.findByReturnRecordIdAndTenantId(returnRecord.getId(), tenantId)
				.map(signature -> ReturnSignatureService.toResponse(returnRecord.getId(), signature))
				.orElse(null);
	}

	/**
	 * A valid access token always points at a still-existing user row (no
	 * endpoint anywhere in this application can delete one — only
	 * deactivate), so this lookup failing is not a normal, user-reachable
	 * error path; {@link ReturnRecordCreator} is responsible for rejecting a
	 * merely-inactive driver.
	 */
	private User findAuthenticatedDriver(AuthenticatedPrincipal principal, Tenant tenant) {
		return userRepository.findByIdAndTenantId(principal.userId(), tenant.getId())
				.orElseThrow(() -> new IllegalStateException("Authenticated driver not found."));
	}

	private static ReturnResponse toResponse(ReturnRecord returnRecord, List<ReturnPhotoResponse> photos, ReturnSignatureResponse signature) {
		User driver = returnRecord.getDriver();
		Route route = returnRecord.getRoute();
		return new ReturnResponse(
				returnRecord.getId(),
				returnRecord.getReturnNumber(),
				returnRecord.getCustomerName(),
				returnRecord.getProductName(),
				returnRecord.getReason(),
				returnRecord.getReasonDetails(),
				returnRecord.getQuantity(),
				returnRecord.getUnit(),
				returnRecord.getObservation(),
				returnRecord.getStatus(),
				new DriverSummaryResponse(driver.getId(), driver.getFullName()),
				new RouteSummaryResponse(route.getId(), route.getCode(), route.getName(), route.isActive()),
				photos,
				signature,
				returnRecord.getCreatedAt(),
				returnRecord.getUpdatedAt());
	}
}
