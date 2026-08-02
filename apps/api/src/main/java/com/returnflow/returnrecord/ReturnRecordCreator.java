package com.returnflow.returnrecord;

import java.util.UUID;
import java.util.function.Supplier;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.returnflow.route.Route;
import com.returnflow.route.RouteRepository;
import com.returnflow.tenant.Tenant;
import com.returnflow.user.User;
import com.returnflow.user.UserRole;

/**
 * The single place every return-creation rule lives, so the driver API
 * (Phase 3B) never has to re-implement them. Deliberately takes the
 * caller's already-authenticated {@link Tenant}/{@link User} directly
 * (never a raw ID, never {@code TenantContext}) — this class has no opinion
 * about how the caller established who's asking; that's the API layer's job.
 */
@Service
class ReturnRecordCreator {

	private static final int CUSTOMER_NAME_MAX_LENGTH = 200;
	private static final int PRODUCT_NAME_MAX_LENGTH = 200;
	private static final int OBSERVATION_MAX_LENGTH = 2000;
	private static final int REASON_DETAILS_MAX_LENGTH = 500;

	private final ReturnRecordRepository returnRecordRepository;
	private final RouteRepository routeRepository;
	private final ReturnNumberGenerator returnNumberGenerator;

	ReturnRecordCreator(ReturnRecordRepository returnRecordRepository, RouteRepository routeRepository,
			ReturnNumberGenerator returnNumberGenerator) {
		this.returnRecordRepository = returnRecordRepository;
		this.routeRepository = routeRepository;
		this.returnNumberGenerator = returnNumberGenerator;
	}

	/**
	 * Groups every driver-supplied field of a new return so
	 * {@link #create(Tenant, User, NewReturn)} doesn't need an unwieldy
	 * parameter list. Deliberately not the HTTP request DTO itself, so this
	 * service stays decoupled from any particular API contract.
	 */
	record NewReturn(String customerName, String productName, ReturnReason reason, String reasonDetails, Integer quantity,
			ReturnUnit unit, String observation) {
	}

	@Transactional
	ReturnRecord create(Tenant tenant, User driver, NewReturn newReturn) {
		if (newReturn.reason() == null) {
			throw new InvalidReasonException();
		}
		String normalizedReasonDetails = validateReasonDetails(newReturn.reason(), newReturn.reasonDetails());
		validateQuantity(newReturn.quantity());
		if (newReturn.unit() == null) {
			throw new InvalidUnitException();
		}
		Route route = validateDriverAndResolveRoute(tenant, driver);
		String normalizedCustomerName = normalize(newReturn.customerName(), CUSTOMER_NAME_MAX_LENGTH, InvalidCustomerNameException::new);
		String normalizedProductName = normalize(newReturn.productName(), PRODUCT_NAME_MAX_LENGTH, InvalidProductNameException::new);
		String normalizedObservation = normalize(newReturn.observation(), OBSERVATION_MAX_LENGTH, InvalidObservationException::new);

		String returnNumber = returnNumberGenerator.next();
		ReturnRecord returnRecord = new ReturnRecord(tenant, returnNumber, driver, route, normalizedCustomerName,
				normalizedProductName, newReturn.reason(), normalizedReasonDetails, newReturn.quantity(), newReturn.unit(),
				normalizedObservation, ReturnStatus.AWAITING_WAREHOUSE);
		return returnRecordRepository.save(returnRecord);
	}

	/**
	 * {@code OTHER} requires nonblank details (root CLAUDE.md §10.1); every
	 * other reason must not carry details at all, so the API contract stays
	 * unambiguous about which field actually drove the return.
	 */
	private static String validateReasonDetails(ReturnReason reason, String reasonDetails) {
		String trimmed = reasonDetails == null ? null : reasonDetails.trim();
		boolean provided = trimmed != null && !trimmed.isEmpty();
		if (reason == ReturnReason.OTHER) {
			if (!provided || trimmed.length() > REASON_DETAILS_MAX_LENGTH) {
				throw new InvalidReasonDetailsException();
			}
			return trimmed;
		}
		if (provided) {
			throw new InvalidReasonDetailsException();
		}
		return null;
	}

	private static void validateQuantity(Integer quantity) {
		if (quantity == null || quantity <= 0) {
			throw new InvalidQuantityException();
		}
	}

	/**
	 * The route always comes from the driver's own assignment — never a
	 * caller-supplied parameter — so a cross-tenant or stale route can never
	 * be attached to a return.
	 */
	private Route validateDriverAndResolveRoute(Tenant tenant, User driver) {
		if (driver.getRole() != UserRole.DRIVER) {
			throw new DriverRequiredException();
		}
		if (!driver.isActive()) {
			throw new InactiveDriverException();
		}
		if (!driver.getTenantId().equals(tenant.getId())) {
			throw new DriverTenantMismatchException();
		}
		UUID routeId = driver.getRouteId();
		if (routeId == null) {
			throw new DriverWithoutRouteException();
		}
		Route route = routeRepository.findByIdAndTenantId(routeId, tenant.getId())
				.orElseThrow(RouteTenantMismatchException::new);
		if (!route.isActive()) {
			throw new InactiveRouteException();
		}
		return route;
	}

	private static String normalize(String value, int maxLength, Supplier<RuntimeException> onInvalid) {
		String trimmed = value == null ? null : value.trim();
		if (trimmed == null || trimmed.isEmpty() || trimmed.length() > maxLength) {
			throw onInvalid.get();
		}
		return trimmed;
	}
}
