package com.returnflow.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * MVP filesystem-backed {@link ReturnMediaStorage} adapter. Production
 * deployment requires a persistent volume mounted at the configured root —
 * a typical container filesystem is ephemeral and loses every file on
 * redeploy, so this adapter is not production-final by itself (see root
 * {@code CLAUDE.md} §29: Cloudflare R2 is the intended production target).
 * It exists purely to keep {@code ReturnMediaStorage} callers working today
 * without requiring cloud credentials for local development; a future
 * R2/S3-compatible adapter can implement the same interface and be swapped
 * in via configuration, with no change needed to any calling code.
 */
@Component
class FilesystemReturnMediaStorage implements ReturnMediaStorage {

	private final Path root;

	FilesystemReturnMediaStorage(@Value("${app.storage.return-media.root}") String rootPath) {
		this.root = Paths.get(rootPath).toAbsolutePath().normalize();
	}

	@Override
	public void store(String storageKey, byte[] content) {
		Path target = resolve(storageKey);
		try {
			Files.createDirectories(target.getParent());
			Files.write(target, content);
		} catch (IOException e) {
			throw new MediaStorageException("Failed to store media object.", e);
		}
	}

	@Override
	public byte[] read(String storageKey) {
		Path target = resolve(storageKey);
		try {
			return Files.readAllBytes(target);
		} catch (IOException e) {
			throw new MediaStorageException("Failed to read media object.", e);
		}
	}

	/**
	 * Resolves {@code storageKey} against {@link #root} and verifies the
	 * result stays inside it. Storage keys are always server-generated (see
	 * {@code returnrecord.ReturnPhotoService}), never derived from a
	 * client-supplied filename, so this is defense-in-depth rather than the
	 * only guard against path traversal (e.g. a key containing {@code ../..}).
	 */
	private Path resolve(String storageKey) {
		Path resolved = root.resolve(storageKey).normalize();
		if (!resolved.startsWith(root)) {
			throw new MediaStorageException("Resolved storage path escapes the configured storage root.");
		}
		return resolved;
	}
}
