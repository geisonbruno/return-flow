# ReturnFlow Diagrams

These diagrams describe the agreed V1 architecture and workflow.

## 1. System context

```mermaid
flowchart LR
    Driver[Driver] --> Mobile[ReturnFlow Mobile\nReact Native + Expo]
    Admin[Warehouse / Manager / Boss\nADMIN] --> Web[ReturnFlow Web\nReact + Vite]

    Mobile --> API[ReturnFlow API\nJava + Spring Boot]
    Web --> API

    API --> DB[(PostgreSQL)]
    API --> Storage[(S3-compatible Object Storage\nCloudflare R2 / MinIO)]
    API --> PDF[On-demand PDF Generator]

    PDF --> Web
```

## 2. Monorepo structure

```mermaid
flowchart TB
    Repo[returnflow monorepo]

    Repo --> Root[Root product documentation]
    Repo --> API[apps/api\nSpring Boot]
    Repo --> Web[apps/web\nReact]
    Repo --> Mobile[apps/mobile\nReact Native + Expo]
    Repo --> Docs[docs]
    Repo --> Infra[infra\nDocker Compose / deployment]
    Repo --> CI[.github/workflows]

    API --> APIDeploy[Independent API build/deploy]
    Web --> WebDeploy[Independent web build/deploy]
    Mobile --> MobileBuild[Independent mobile build/test]
```

## 3. Return lifecycle

```mermaid
stateDiagram-v2
    [*] --> WAITING_WAREHOUSE: Driver creates return

    WAITING_WAREHOUSE --> WAITING_WAREHOUSE: Driver edits
    WAITING_WAREHOUSE --> IN_REVIEW: Admin clicks Start Review
    WAITING_WAREHOUSE --> CANCELLED: Admin cancels

    IN_REVIEW --> WAITING_WAREHOUSE: Admin releases review
    IN_REVIEW --> CLOSED: Admin completes required fields and closes
    IN_REVIEW --> CANCELLED: Admin cancels

    CLOSED --> [*]
    CANCELLED --> [*]
```

## 4. Driver create flow

```mermaid
sequenceDiagram
    actor Driver
    participant Mobile
    participant API
    participant DB
    participant Storage

    Driver->>Mobile: Open New Return
    Mobile->>API: Load active reasons
    API->>DB: Query tenant reasons
    DB-->>API: Reasons
    API-->>Mobile: Reasons

    Driver->>Mobile: Enter return data
    Driver->>Mobile: Add photos and customer signature
    Mobile->>API: Create return data
    API->>DB: Create WAITING_WAREHOUSE return
    DB-->>API: Return ID and return number

    Mobile->>API: Upload photos/signature
    API->>Storage: Store tenant-scoped objects
    Storage-->>API: Stored
    API->>DB: Save object metadata
    API-->>Mobile: Completed return response
    Mobile-->>Driver: Show saved return and status
```

## 5. Warehouse review flow

```mermaid
sequenceDiagram
    actor Admin
    participant Web
    participant API
    participant DB

    Admin->>Web: Open return details
    Web->>API: GET return
    API->>DB: Query tenant-scoped return
    DB-->>API: Return data
    API-->>Web: Read-only details

    Admin->>Web: Click Start Review
    Web->>API: POST start-review
    API->>DB: Atomic status/owner update
    DB-->>API: IN_REVIEW
    API-->>Web: Review claimed

    Admin->>Web: Complete warehouse fields and signature
    Web->>API: PUT review
    API->>DB: Validate owner/version and save
    DB-->>API: Saved

    Admin->>Web: Click Close
    Web->>API: POST close
    API->>DB: Validate mandatory fields and close
    DB-->>API: CLOSED
    API-->>Web: Closed return

    Admin->>Web: Download PDF
    Web->>API: GET PDF
    API-->>Web: Generated PDF
```

## 6. Tenant isolation

```mermaid
flowchart TB
    Request[Authenticated Request] --> Security[Spring Security]
    Security --> Context[User + Role + Tenant Context]
    Context --> Service[Application Service]
    Service --> Repo[Tenant-scoped Repository Query]
    Repo --> DB[(Shared PostgreSQL Schema)]

    ClientTenant[Client-provided tenant_id] -. rejected / ignored .-> Service
```

## 7. Domain relationships

```mermaid
erDiagram
    TENANT ||--o{ USER : owns
    TENANT ||--o{ ROUTE : owns
    TENANT ||--o{ RETURN_REASON : configures
    TENANT ||--o{ PRODUCT_RETURN : owns

    ROUTE ||--o{ USER : assigned_to_driver
    USER ||--o{ PRODUCT_RETURN : creates_as_driver
    RETURN_REASON ||--o{ PRODUCT_RETURN : classifies

    PRODUCT_RETURN ||--o{ RETURN_PHOTO : contains
    PRODUCT_RETURN ||--o{ RETURN_EVENT : records

    USER ||--o{ PRODUCT_RETURN : reviews_or_closes
```

## 8. Main ProductReturn fields

```mermaid
classDiagram
    class ProductReturn {
      UUID id
      UUID tenantId
      String returnNumber
      UUID driverId
      UUID routeId
      String routeSnapshot
      String customerName
      String productDescription
      int quantity
      ReturnUnit unit
      UUID reasonId
      String reasonDetails
      String driverObservation
      ReturnStatus status
      String customerRepresentativeName
      String customerSignatureKey
      UUID reviewStartedBy
      Instant reviewStartedAt
      Boolean sellable
      Boolean creditCustomer
      Boolean chargeCustomer
      Boolean chargeDriver
      String warehouseObservation
      String warehouseRepresentativeName
      String warehouseSignatureKey
      UUID closedBy
      Instant closedAt
      UUID cancelledBy
      Instant cancelledAt
      String cancellationReason
      long version
      Instant createdAt
      Instant updatedAt
    }
```

## 9. Deployment target

```mermaid
flowchart LR
    GitHub[GitHub Monorepo] --> Actions[GitHub Actions]

    Actions --> APIHost[Managed API Host\nInitial target: Railway]
    Actions --> WebHost[Static Web Host\nCloudflare Pages]
    Actions --> MobileCI[Mobile checks / future builds]

    APIHost --> Neon[(Managed PostgreSQL\nInitial target: Neon)]
    APIHost --> R2[(Cloudflare R2)]
    WebHost --> APIHost
    MobileApp[Expo Mobile App] --> APIHost
```

Provider pricing and free-tier limits must be revalidated before deployment.
