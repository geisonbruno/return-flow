package com.returnflow.tenant;

/**
 * Holds the tenant resolved for the current request thread. Modeled after
 * Spring Security's {@code SecurityContextHolder}: callers only ever see
 * {@link #set}/{@link #get}/{@link #clear} — nothing outside this class knows
 * (or should know) that the storage mechanism is a {@link ThreadLocal}.
 */
public final class TenantContext {

	private static final ThreadLocal<Tenant> CURRENT_TENANT = new ThreadLocal<>();

	private TenantContext() {
	}

	public static void set(Tenant tenant) {
		CURRENT_TENANT.set(tenant);
	}

	public static Tenant get() {
		return CURRENT_TENANT.get();
	}

	public static void clear() {
		CURRENT_TENANT.remove();
	}
}
