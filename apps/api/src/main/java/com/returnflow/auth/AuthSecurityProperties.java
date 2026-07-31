package com.returnflow.auth;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record AuthSecurityProperties(AccessToken accessToken, RefreshToken refreshToken) {

	public record AccessToken(String secret, Duration ttl) {
	}

	public record RefreshToken(Duration ttl) {
	}
}
