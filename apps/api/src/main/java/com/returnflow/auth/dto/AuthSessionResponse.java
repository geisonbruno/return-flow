package com.returnflow.auth.dto;

import java.time.Instant;

public record AuthSessionResponse(String accessToken, Instant accessTokenExpiresAt, String refreshToken,
		String tokenType) {

	public AuthSessionResponse(String accessToken, Instant accessTokenExpiresAt, String refreshToken) {
		this(accessToken, accessTokenExpiresAt, refreshToken, "Bearer");
	}
}
