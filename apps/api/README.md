# ReturnFlow API

Backend for ReturnFlow (Spring Boot 4.1, Java 21, Maven Wrapper). See the root and `apps/api/CLAUDE.md` for product scope and architecture rules.

## Commands

```powershell
# Start Postgres first: docker compose -f ../../infra/docker-compose.yml up -d
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"   # start the API on http://localhost:8080
.\mvnw.cmd test                                                  # run tests (spins up its own Postgres via Testcontainers)
.\mvnw.cmd -q package                                             # build the jar
```

No datasource is configured without an active profile — the app intentionally refuses to start against an undefined database. Use `-Dspring-boot.run.profiles=local` (or set `SPRING_PROFILES_ACTIVE=local`) for local development against the Docker Compose Postgres; production deployments set `SPRING_PROFILES_ACTIVE=prod` with `DATABASE_URL`/`DATABASE_USERNAME`/`DATABASE_PASSWORD` supplied by the environment.

Health check: `GET http://localhost:8080/actuator/health`.
OpenAPI docs: `GET http://localhost:8080/v3/api-docs`, Swagger UI: `GET http://localhost:8080/swagger-ui.html`.
