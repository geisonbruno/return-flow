package com.returnflow;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Shared Postgres-backed test strategy: any {@code @SpringBootTest} that
 * imports this gets a real, ephemeral Postgres container wired in as the
 * datasource (via {@code @ServiceConnection}), so Flyway migrations and
 * Hibernate schema validation run against the same database engine used in
 * production instead of an in-memory substitute.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	@Bean
	@ServiceConnection
	PostgreSQLContainer<?> postgresContainer() {
		return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
	}
}
