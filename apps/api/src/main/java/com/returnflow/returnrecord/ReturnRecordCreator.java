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
 * The single place every return-creation rule lives, so the future driver
 * API (Phase 3B) never has to re-implement them. Deliberately takes the
 * caller's already-authenticated {@link Tenant}/{@link User} directly
 * (never a raw ID, never {@code TenantContext}) — this class has no opinion
 * about how the caller established who's asking; that's the future API
 * layer's job.
 */
@Service
class ReturnRecordCreator {

	private static final int CUSTOMER_NAME_MAX_LENGTH = 200;
	private static final int OBSERVATION_MAX_LENGTH = 2000;

	private final ReturnRecordRepository returnRecordRepository;
	private final RouteRepository routeRepository;
	private final ReturnNumberGenerator returnNumberGenerator;

	ReturnRecordCreator(ReturnRecordRepository returnRecordRepository, RouteRepository routeRepository,
			ReturnNumberGenerator returnNumberGenerator) {
		this.returnRecordRepository = returnRecordRepository;
		this.routeRepository = routeRepository;
		this.returnNumberGenerator = returnNumberGenerator;
	}

	@Transactional
	ReturnRecord create(Tenant tenant, User driver, String customerName, ReturnReason reason, String observation) {
		if (reason == null) {
			throw new InvalidReasonException();
		}
		Route route = validateDriverAndResolveRoute(tenant, driver);
		String normalizedCustomerName = normalize(customerName, CUSTOMER_NAME_MAX_LENGTH, InvalidCustomerNameException::new);
		String normalizedObservation = normalize(observation, OBSERVATION_MAX_LENGTH, InvalidObservationException::new);

		String returnNumber = returnNumberGenerator.next();
		ReturnRecord returnRecord = new ReturnRecord(tenant, returnNumber, driver, route, normalizedCustomerName, reason,
				normalizedObservation, ReturnStatus.AWAITING_WAREHOUSE);
		return returnRecordRepository.save(returnRecord);
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
