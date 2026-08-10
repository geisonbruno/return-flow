package com.returnflow.returnrecord;

/**
 * Distinguishes the two signature slots a return can have — at most one of
 * each, per root {@code CLAUDE.md} §13.1's "model for any future signature
 * capture, including the eventual warehouse signature." Every existing
 * {@code return_signature} row predates this column and is backfilled to
 * {@code CUSTOMER} by V13 (the only kind that could have existed before
 * Phase 7A).
 */
enum SignatureType {
	CUSTOMER,
	WAREHOUSE
}
