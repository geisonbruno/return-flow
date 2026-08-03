package com.returnflow.storage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Plain unit tests — no Spring context needed, each test gets its own fresh {@code @TempDir}. */
class FilesystemReturnMediaStorageTest {

	@TempDir
	Path tempDir;

	private FilesystemReturnMediaStorage storage;

	@BeforeEach
	void setUp() {
		storage = new FilesystemReturnMediaStorage(tempDir.toString());
	}

	@Test
	void storedContentCanBeReadBackExactly() {
		byte[] content = "a jpeg's worth of bytes, in spirit".getBytes(StandardCharsets.UTF_8);

		storage.store("tenants/t1/returns/r1/photos/p1.jpg", content);

		assertThat(storage.read("tenants/t1/returns/r1/photos/p1.jpg")).isEqualTo(content);
	}

	@Test
	void generatedStorageKeysStayInsideTheConfiguredRoot() throws IOException {
		storage.store("tenants/t1/returns/r1/photos/p1.jpg", "content".getBytes(StandardCharsets.UTF_8));

		Path expected = tempDir.resolve("tenants/t1/returns/r1/photos/p1.jpg");
		assertThat(Files.exists(expected)).isTrue();
		assertThat(expected.normalize().startsWith(tempDir.toAbsolutePath().normalize())).isTrue();
	}

	@Test
	void aPathTraversalKeyIsRejectedRatherThanEscapingTheRoot() {
		assertThatThrownBy(() -> storage.store("../../etc/passwd", "malicious".getBytes(StandardCharsets.UTF_8)))
				.isInstanceOf(MediaStorageException.class);
	}

	@Test
	void aPathTraversalReadIsAlsoRejected() {
		assertThatThrownBy(() -> storage.read("../../etc/passwd")).isInstanceOf(MediaStorageException.class);
	}

	@Test
	void readingMissingContentThrowsASafeStorageException() {
		assertThatThrownBy(() -> storage.read("tenants/t1/returns/r1/photos/does-not-exist.jpg"))
				.isInstanceOf(MediaStorageException.class);
	}
}
