package com.returnflow.common.error.support;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only fixture (never shipped in main) used solely to exercise
 * {@code GlobalExceptionHandler} through real MVC request handling.
 */
@RestController
@RequestMapping("/test-fixture")
public class TestFixtureController {

	@PostMapping("/validate")
	public ResponseEntity<Void> validate(@Valid @RequestBody TestPayload payload) {
		return ResponseEntity.ok().build();
	}

	@GetMapping("/boom")
	public void boom() {
		throw new IllegalStateException("boom");
	}
}
