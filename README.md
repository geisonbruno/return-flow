# ReturnFlow

ReturnFlow is a multi-tenant B2B SaaS that digitizes the product-return workflow — from the driver who records a return to the warehouse admin who reviews, closes, and prints it. See `CLAUDE.md` for the full product specification and `docs/IMPLEMENTATION_PLAN.md` for the phased build plan.

## Repository layout

```text
returnflow/
├── apps/
│   ├── api/      Spring Boot backend (Java 21, Maven Wrapper)
│   ├── web/      Admin console (React + TypeScript + Vite)
│   └── mobile/   Driver app (React Native + Expo)
├── docs/         Architecture diagrams and implementation plan
├── infra/        Local development infrastructure (Docker Compose)
└── scripts/      Reserved for future automation
```

Each app has its own dependencies, build, lint, and test commands, and deploys independently.

## Prerequisites

- Java 21 (Temurin recommended)
- Node.js 20.19+ or 22.12+ (Expo's CLI enforces this minimum)
- Docker Desktop (for local Postgres/MinIO)

## Local development (Windows PowerShell)

### 1. Infrastructure (PostgreSQL + MinIO)

```powershell
docker compose -f infra/docker-compose.yml up -d
```

Copy `infra/.env.example` to `infra/.env` to override the default local credentials/ports if needed.

### 2. API

```powershell
cd apps/api
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Runs at `http://localhost:8080` against the Postgres started in step 1 (no datasource is configured without an explicit profile, so the app refuses to start otherwise). Run tests with `.\mvnw.cmd test` — they spin up their own ephemeral Postgres via Testcontainers, independent of the Docker Compose instance.

### 3. Web

```powershell
cd apps/web
npm install
npm run dev
```

Runs at `http://localhost:5173`. Copy `apps/web/.env.example` to `.env` first.

### 4. Mobile

```powershell
cd apps/mobile
npm install
npx expo start
```

Copy `apps/mobile/.env.example` to `.env` first.

## VS Code tasks

`.vscode/tasks.json` provides: Start/Stop Infrastructure, Run API, Run API Tests, Run Web, Run Web Tests, Run Mobile, Run Mobile Tests.

## Contributing

Development happens in small, reviewable phases — see `docs/IMPLEMENTATION_PLAN.md` and `progress.md` for current status. Read `CLAUDE.md` (and the nearest `apps/*/CLAUDE.md`) before making product or architecture decisions.
