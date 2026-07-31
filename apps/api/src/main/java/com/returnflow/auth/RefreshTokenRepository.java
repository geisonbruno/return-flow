package com.returnflow.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshTokenSession, UUID> {

	Optional<RefreshTokenSession> findByTokenHash(String tokenHash);

	List<RefreshTokenSession> findByUserId(UUID userId);
}
