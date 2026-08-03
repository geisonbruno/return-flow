package com.returnflow.storage;

/**
 * Separates return-media binary storage (photos now, the customer signature
 * in a later phase) from PostgreSQL, which only ever holds metadata. Callers
 * generate {@code storageKey} themselves (see {@code returnrecord.ReturnPhoto}) —
 * this interface never accepts or derives a key from client-supplied input.
 *
 * <p>Deliberately minimal: Phase 5A needs only store and read. Do not add
 * delete, list, or presigned-URL capabilities until a real caller needs
 * them — see root {@code CLAUDE.md} on avoiding speculative abstraction.
 */
public interface ReturnMediaStorage {

	/** Writes {@code content} under {@code storageKey}, creating any missing parent directories. */
	void store(String storageKey, byte[] content);

	/** Reads the full binary content previously stored under {@code storageKey}. */
	byte[] read(String storageKey);
}
