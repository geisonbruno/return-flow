package com.returnflow.returnrecord;

/**
 * The MVP set of operational return reasons, exactly as defined in root
 * {@code CLAUDE.md} §10.
 */
public enum ReturnReason {
	WRONG_ITEM_DELIVERED,
	EXTRA_ITEM,
	MISSING_ITEM,
	CUSTOMER_CHARGE_REQUIRED,
	NO_LONGER_REQUIRED,
	WRONG_ITEM_ORDERED,
	EXCHANGE_REQUIRED,
	DAMAGED,
	LEAKING,
	NOT_ORDERED,
	OTHER
}
