package com.returnflow.returnrecord;

/**
 * The human-readable label for each {@link ReturnReason}, exactly as defined
 * in root {@code CLAUDE.md} §10. Used only where the backend itself renders
 * text for a person to read — currently the administrative PDF; the JSON API
 * keeps returning the raw enum name so each client owns its own presentation.
 *
 * <p>The switch is deliberately exhaustive with no {@code default}: adding a
 * reason to the enum without giving it a label becomes a compile error rather
 * than a PDF that prints a raw {@code SCREAMING_SNAKE_CASE} code.
 */
final class ReturnReasonLabels {

	private ReturnReasonLabels() {
	}

	static String labelFor(ReturnReason reason) {
		return switch (reason) {
			case WRONG_ITEM_DELIVERED -> "Wrong item delivered";
			case EXTRA_ITEM -> "Extra item";
			case MISSING_ITEM -> "Missing item";
			case CUSTOMER_CHARGE_REQUIRED -> "Customer needs to be charged";
			case NO_LONGER_REQUIRED -> "No longer required";
			case WRONG_ITEM_ORDERED -> "Wrong item ordered";
			case EXCHANGE_REQUIRED -> "Exchange required";
			case DAMAGED -> "Damaged";
			case LEAKING -> "Leaking";
			case NOT_ORDERED -> "Not ordered";
			case OTHER -> "Other";
		};
	}
}
