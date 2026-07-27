# PROJECT_MAP.md — تطبيق هاتف لإدارة المزرعة عن بُعد

**Generated:** 2026-07-28
**Architecture Decision:** Mobile-First Monolith (Microservices extraction path documented in [ORPHANS & PENDING])
**Stack Baseline Date:** 2026-07 (Node 24 LTS / React Native 0.86 / Express 5 / Prisma 7.9 / PostgreSQL 18 / TS 7.0)

---

## [TECH_STACK]

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Runtime** | Node.js | 24.18.0 LTS (Krypton) | Active LTS until 2026-10, maintenance to 2028-04 |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient, monorepo-native |
| **Language** | TypeScript | 7.0 | Go native compiler, 10x faster builds, strict mode |
| **Mobile Framework** | React Native | 0.86.0 (Active) | New Architecture default, Edge-to-Edge, Metro 0.84.2 |
| **Navigation** | React Navigation | 7.3.14 (stable) | Native stack, bottom tabs, drawer |
| **State (Client)** | Zustand | 5.0.14 | Lightweight, no boilerplate, hooks-based |
| **Local Storage** | React Native MMKV | 4.3.2 | Fastest key-value storage, Nitro Module |
| **Forms** | React Hook Form + Zod | Latest | Type-safe validation, minimal re-renders |
| **Backend Framework** | Express | 5.2.1 (ACTIVE) | LTS until 2027, async/await native |
| **Database** | PostgreSQL | 18.4 (Latest Stable) | JSONB, partitioning, logical replication |
| **ORM** | Prisma ORM | 7.9.0 | Adapter-based, no query engine binary |
| **Migrations** | Prisma Migrate | 7.9.0 | `migrate dev` (dev), `migrate deploy` (prod) |
| **API Layer** | REST + Zod Validation | Express 5 + Zod | Simple, mobile-friendly, type-safe |
| **Realtime** | Socket.io | Latest | WebSocket for sensor data, alerts |
| **File Storage** | S3-compatible (MinIO / S3 / R2) | - | Presigned URLs for farm images |
| **Background Jobs** | BullMQ + Redis | BullMQ 5.x / Redis 7 | Job queues for notifications, reports |
| **Logging** | Pino (async) | Pino 9.x | Async, structured JSON, low overhead |
| **Testing** | Vitest + React Native Testing Library | Latest | Unit, integration, E2E |
| **CI/CD** | GitHub Actions + EAS Build | - | Mobile builds, API deployment |

**Explicitly Avoided (Deprecated/Unstable):**
- Node.js 26 (Current, not LTS)
- Prisma < 7 (legacy query engine binary)
- React Native < 0.86 (Old Architecture)
- Express 4.x (Maintenance only, EOL soon)
- PostgreSQL < 18 (older major versions)

---

## [SYSTEM_FLOW]

### User Journeys (Verifiable Goals)

#### Farmer Journey (Mobile App)
1. **Dashboard** -> View farm overview: crops status, livestock health, weather, alerts
2. **Crop Management** -> Add/edit fields, track planting/harvest dates, log activities (watering, fertilizing, spraying)
3. **Livestock Management** -> Register animals, track health records, feeding schedules, veterinary visits
4. **Irrigation Control** -> View zones, manual/automatic scheduling, sensor readings (moisture, pH)
5. **Weather Monitoring** -> Current conditions, 7-day forecast, alerts (frost, heavy rain, wind)
6. **Inventory Management** -> Track seeds, fertilizers, feed, equipment; low stock alerts
7. **Worker Management** -> Assign tasks, track attendance, log work hours
8. **Financial Tracking** -> Log expenses/revenue, view profit/loss, export reports

### Data Flow (API)

```
┌─────────────────┐         REST API          ┌──────────────────┐
│  React Native   │  <──────────────────────>  │  Express 5 API   │
│  (Mobile App)   │                            │  (Node.js 24)    │
└────────┬────────┘                            └────────┬─────────┘
         │                                              │
         v                                              v
┌─────────────────┐                            ┌──────────────────┐
│  MMKV Storage   │                            │  Prisma ORM      │
│  (Offline Cache)│                            │  (PostgreSQL 18) │
└─────────────────┘                            └──────────────────┘
                                                       │
                                                       v
┌─────────────────────────────────────────────────────────────┐
│                    Background Workers (BullMQ)              │
│  • Notification Dispatch  • Report Generation              │
│  • IoT Data Processing   • Scheduled Tasks                 │
└─────────────────────────────────────────────────────────────┘
```

---

## [ARCHITECTURE]

### Monorepo Structure (pnpm Workspaces)

```
farm-management/
├── apps/
│   ├── mobile/                     # React Native 0.86 (Expo)
│   │   ├── app/                    # Expo Router (file-based routing)
│   │   ├── components/             # Reusable UI components
│   │   ├── features/               # Domain features
│   │   │   ├── dashboard/
│   │   │   ├── crops/
│   │   │   ├── livestock/
│   │   │   ├── irrigation/
│   │   │   ├── weather/
│   │   │   ├── inventory/
│   │   │   ├── workers/
│   │   │   └── finance/
│   │   ├── stores/                 # Zustand stores
│   │   ├── services/               # API client, MMKV, sensors
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── utils/                  # Pure utility functions
│   │   └── package.json
│   │
│   └── api/                        # Express 5 Backend
│       ├── src/
│       │   ├── routes/             # Express routers per domain
│       │   ├── controllers/        # Request handlers
│       │   ├── services/           # Business logic
│       │   ├── middleware/         # Auth, validation, error handling
│       │   ├── validators/        # Zod schemas
│       │   └── index.ts           # App entry point
│       └── package.json
│
├── packages/
│   ├── core/                       # Shared kernel (ZERO business logic)
│   │   ├── src/
│   │   │   ├── config/             # Env validation (Zod)
│   │   │   ├── logging/            # Pino logger (async, structured)
│   │   │   ├── errors/             # AppError classes, error codes
│   │   │   ├── validation/         # Shared Zod schemas
│   │   │   └── utils/              # Pure utils (date, currency, id)
│   │   └── package.json
│   │
│   ├── db/                         # Database layer (Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Single source of truth
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts           # PrismaClient singleton
│   │   │   ├── extensions/         # Prisma extensions (soft delete, audit)
│   │   │   └── repositories/       # Repository pattern per domain
│   │   └── package.json
│   │
│   ├── auth/                       # Authentication (JWT + Refresh Token)
│   │   ├── src/
│   │   │   ├── config.ts           # JWT settings, providers
│   │   │   ├── permissions.ts      # RBAC definitions
│   │   │   └── middleware.ts       # Express middleware
│   │   └── package.json
│   │
│   ├── notifications/              # Push notifications (Expo Push)
│   │   ├── src/
│   │   │   ├── providers/          # Expo Push, Email
│   │   │   ├── templates/          # Notification templates
│   │   │   └── queue.ts            # BullMQ job definitions
│   │   └── package.json
│   │
│   └── api-contracts/              # Shared Zod schemas (mobile + API)
│       ├── src/
│       │   ├── schemas/            # Zod schemas (shared validation)
│       │   └── types/              # TypeScript types
│       └── package.json
│
├── tools/
│   ├── eslint-config/              # Shared ESLint config
│   └── tsconfig/                   # Shared TS configs
│
├── docker/
│   ├── docker-compose.yml          # PostgreSQL, Redis, MinIO
│   └── .env.example
│
├── pnpm-workspace.yaml
├── package.json
├── turbo.json                      # Turborepo config
└── PROJECT_MAP.md
```

### Domain Model (Prisma Schema - Core Entities)

```prisma
// packages/db/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────────
// CORE DOMAINS
// ──────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  phone         String?   @unique
  passwordHash  String
  name          String
  role          UserRole  @default(FARMER)
  status        UserStatus @default(ACTIVE)
  farmId        String?
  farm          Farm?     @relation(fields: [farmId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tasks         Task[]
  activityLogs  ActivityLog[]
  notifications Notification[]

  @@index([email])
  @@index([farmId])
}

enum UserRole {
  FARMER
  MANAGER
  WORKER
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

model Farm {
  id          String   @id @default(cuid())
  name        String
  description String?
  location    Json?    // { lat, lng, address, city, country }
  area        Decimal? @db.Decimal(10, 2) // hectares
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  fields      Field[]
  livestock   Livestock[]
  inventory   Inventory[]
  irrZones    IrrigationZone[]

  @@index([name])
}

// ──────────────────────────────────────────────
// CROPS DOMAIN
// ──────────────────────────────────────────────

model Field {
  id          String   @id @default(cuid())
  farmId      String
  farm        Farm     @relation(fields: [farmId], references: [id], onDelete: Cascade)
  name        String
  area        Decimal  @db.Decimal(10, 2) // hectares
  soilType    String?
  location    Json?    // { lat, lng, polygon }
  status      FieldStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  crops       Crop[]
  activities  Activity[]

  @@index([farmId])
  @@index([status])
}

enum FieldStatus {
  ACTIVE
  FALLOW
  MAINTENANCE
}

model Crop {
  id            String     @id @default(cuid())
  fieldId       String
  field         Field      @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  name          String
  variety       String?
  plantingDate  DateTime
  harvestDate   DateTime?
  expectedYield Decimal?   @db.Decimal(10, 2) // kg
  actualYield   Decimal?   @db.Decimal(10, 2)
  status        CropStatus @default(PLANTED)
  notes         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  activities    Activity[]

  @@index([fieldId])
  @@index([status])
  @@index([plantingDate])
}

enum CropStatus {
  PLANTED
  GROWING
  FLOWERING
  HARVESTED
  FAILED
}

model Activity {
  id          String   @id @default(cuid())
  fieldId     String
  field       Field    @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  cropId      String?
  crop        Crop?    @relation(fields: [cropId], references: [id])
  type        ActivityType
  description String
  date        DateTime
  cost        Decimal? @db.Decimal(10, 2)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([fieldId])
  @@index([cropId])
  @@index([date])
}

enum ActivityType {
  PLANTING
  WATERING
  FERTILIZING
  SPRAYING
  HARVESTING
  TILLING
  PRUNING
  OTHER
}

// ──────────────────────────────────────────────
// LIVESTOCK DOMAIN
// ──────────────────────────────────────────────

model Livestock {
  id          String        @id @default(cuid())
  farmId      String
  farm        Farm          @relation(fields: [farmId], references: [id], onDelete: Cascade)
  name        String
  type        LivestockType
  breed       String?
  tagNumber   String?       @unique
  birthDate   DateTime?
  gender      Gender?
  status      LivestockStatus @default(ACTIVE)
  notes       String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  healthLogs  HealthLog[]
  feedLogs    FeedLog[]

  @@index([farmId])
  @@index([type])
  @@index([status])
}

enum LivestockType {
  CATTLE
  SHEEP
  GOAT
  POULTRY
  PIG
  OTHER
}

enum Gender {
  MALE
  FEMALE
}

enum LivestockStatus {
  ACTIVE
  SOLD
  DECEASED
  ARCHIVED
}

model HealthLog {
  id          String   @id @default(cuid())
  livestockId String
  livestock   Livestock @relation(fields: [livestockId], references: [id], onDelete: Cascade)
  type        HealthType
  description String
  date        DateTime
  vetName     String?
  cost        Decimal? @db.Decimal(10, 2)
  nextDue     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([livestockId])
  @@index([date])
}

enum HealthType {
  VACCINATION
  TREATMENT
  CHECKUP
  SURGERY
  OTHER
}

model FeedLog {
  id          String   @id @default(cuid())
  livestockId String
  livestock   Livestock @relation(fields: [livestockId], references: [id], onDelete: Cascade)
  feedType    String
  quantity    Decimal  @db.Decimal(10, 2) // kg
  unit        String   @default("kg")
  date        DateTime
  cost        Decimal? @db.Decimal(10, 2)
  createdAt   DateTime @default(now())

  @@index([livestockId])
  @@index([date])
}

// ──────────────────────────────────────────────
// IRRIGATION DOMAIN
// ──────────────────────────────────────────────

model IrrigationZone {
  id          String    @id @default(cuid())
  farmId      String
  farm        Farm      @relation(fields: [farmId], references: [id], onDelete: Cascade)
  name        String
  fieldId     String?
  status      IrrigationStatus @default(AUTO)
  schedule    Json?     // { cron, duration, intervals }
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sensorLogs  SensorLog[]

  @@index([farmId])
}

enum IrrigationStatus {
  AUTO
  MANUAL
  OFFLINE
}

model SensorLog {
  id              String   @id @default(cuid())
  zoneId          String
  zone            IrrigationZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)
  temperature     Decimal? @db.Decimal(5, 2) // celsius
  humidity        Decimal? @db.Decimal(5, 2) // percentage
  soilMoisture    Decimal? @db.Decimal(5, 2) // percentage
  soilPH          Decimal? @db.Decimal(4, 2)
  lightIntensity  Decimal? @db.Decimal(7, 2) // lux
  windSpeed       Decimal? @db.Decimal(5, 2) // km/h
  rainfall        Decimal? @db.Decimal(5, 2) // mm
  recordedAt      DateTime @default(now())

  @@index([zoneId, recordedAt])
}

// ──────────────────────────────────────────────
// WEATHER DOMAIN
// ──────────────────────────────────────────────

model WeatherForecast {
  id            String   @id @default(cuid())
  farmId        String
  date          DateTime
  tempHigh      Decimal  @db.Decimal(5, 2)
  tempLow       Decimal  @db.Decimal(5, 2)
  condition     String   // sunny, cloudy, rainy, etc.
  precipitation Decimal? @db.Decimal(5, 2) // mm
  windSpeed     Decimal? @db.Decimal(5, 2) // km/h
  humidity      Decimal? @db.Decimal(5, 2) // percentage
  alert         String?
  createdAt     DateTime @default(now())

  @@unique([farmId, date])
  @@index([farmId])
}

// ──────────────────────────────────────────────
// INVENTORY DOMAIN
// ──────────────────────────────────────────────

model Inventory {
  id          String        @id @default(cuid())
  farmId      String
  farm        Farm          @relation(fields: [farmId], references: [id], onDelete: Cascade)
  name        String
  category    InventoryCategory
  quantity    Decimal       @db.Decimal(10, 2)
  unit        String        @default("kg")
  minQuantity Decimal?      @db.Decimal(10, 2) // alert threshold
  costPerUnit Decimal?      @db.Decimal(10, 2)
  location    String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  movements   InventoryMovement[]

  @@index([farmId])
  @@index([category])
}

enum InventoryCategory {
  SEED
  FERTILIZER
  PESTICIDE
  FEED
  EQUIPMENT
  FUEL
  OTHER
}

model InventoryMovement {
  id            String   @id @default(cuid())
  inventoryId   String
  inventory     Inventory @relation(fields: [inventoryId], references: [id], onDelete: Cascade)
  type          MovementType
  quantity      Decimal  @db.Decimal(10, 2)
  reference     String?  // purchase order, task reference
  notes         String?
  createdBy     String
  createdAt     DateTime @default(now())

  @@index([inventoryId])
  @@index([createdAt])
}

enum MovementType {
  IN
  OUT
  ADJUSTMENT
}

// ──────────────────────────────────────────────
// WORKERS DOMAIN
// ──────────────────────────────────────────────

model Task {
  id          String     @id @default(cuid())
  farmId      String
  title       String
  description String?
  assignedTo  String?
  user        User?      @relation(fields: [assignedTo], references: [id])
  status      TaskStatus @default(PENDING)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([farmId])
  @@index([assignedTo])
  @@index([status])
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// ──────────────────────────────────────────────
// FINANCE DOMAIN
// ──────────────────────────────────────────────

model Transaction {
  id          String            @id @default(cuid())
  farmId      String
  type        TransactionType
  category    String
  amount      Decimal           @db.Decimal(12, 2)
  currency    String            @default("USD")
  date        DateTime
  description String?
  reference   String?           // invoice, receipt number
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([farmId])
  @@index([type])
  @@index([date])
}

enum TransactionType {
  INCOME
  EXPENSE
}

// ──────────────────────────────────────────────
// SUPPORTING DOMAINS
// ──────────────────────────────────────────────

model Notification {
  id        String              @id @default(cuid())
  userId    String
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  message   String
  data      Json?
  readAt    DateTime?
  sentAt    DateTime?
  createdAt DateTime            @default(now())

  @@index([userId, readAt])
  @@index([createdAt])
}

enum NotificationType {
  WEATHER_ALERT
  TASK_REMINDER
  INVENTORY_LOW
  HEALTH_DUE
  IRRIGATION_ALERT
  SYSTEM
}

model ActivityLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String
  entityType String
  entityId  String
  oldData   Json?
  newData   Json?
  ipAddress String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### Module Boundaries & Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/mobile (React Native 0.86)               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Dashboard│ │ Crops   │ │Livestock│ │Irrigation│ │Weather  │   │
│  │ Feature │ │ Feature │ │ Feature │ │ Feature │ │ Feature │   │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │
└───────┼───────────┼───────────┼───────────┼───────────┼────────┘
        │           │           │           │           │
        v           v           v           v           v
┌─────────────────────────────────────────────────────────────────┐
│                    packages/api-contracts                       │
│              (Zod schemas + Types - SHARED)                    │
└─────────────────────────────────────────────────────────────────┘
        │           │           │           │           │
        v           v           v           v           v
┌─────────────────────────────────────────────────────────────────┐
│                         packages/db                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐   │
│  │ Repositories│ │   Prisma    │ │ Extensions  │ │Migrations│   │
│  │ (per domain)│ │   Client    │ │ (softDelete,│ │          │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
        ^           ^           ^           ^           ^
        │           │           │           │           │
┌───────┴───────────┴───────────┴───────────┴───────────┴───────┐
│                    packages/core (SHARED KERNEL)                │
│  config | logging | errors | validation | utils | constants    │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency Rules (Enforced by ESLint):**
- `apps/*` -> `packages/api-contracts` -> `packages/db` -> `packages/core`
- `packages/*` -> `packages/core` ONLY
- **NO** cross-feature imports (e.g., `features/crops` cannot import `features/livestock`)
- **NO** `packages/db` imports in `apps/*` directly (must go through repositories)

---

## [ORPHANS & PENDING]

### Critical Decisions Needed (Blockers)
| ID | Decision | Options | Owner | Due |
|----|----------|---------|-------|-----|
| DEC-001 | IoT Integration? | MQTT (complex) vs REST polling (simple) vs None (MVP) | Tech Lead | Sprint 0 |
| DEC-002 | Weather API? | OpenWeatherMap (free tier) vs WeatherAPI vs Manual entry | PO | Sprint 0 |
| DEC-003 | Offline Support? | MMKV cache (simple) vs WatermelonDB (complex) vs None | Mobile Lead | Sprint 1 |
| DEC-004 | Multi-farm Support? | Single farm (MVP) vs Multi-farm (future) | PO | Sprint 0 |

### Technical Debt / Extraction Candidates (Post-MVP)
| ID | Item | Extraction Trigger | Target |
|----|------|-------------------|--------|
| EXT-001 | Notification Service | Multi-channel, template mgmt, scaling | Microservice |
| EXT-002 | Weather/IoT Service | Real-time data, separate scaling | Microservice |
| EXT-003 | Reporting/Analytics | Heavy read queries, separate scaling | Service + ClickHouse |

### Deferred / Nice-to-Have (Not in MVP)
| ID | Feature | Reason |
|----|---------|--------|
| DEF-001 | AI Crop Disease Detection | Requires ML model, post-MVP |
| DEF-002 | Drone Integration | Hardware dependency, complex |
| DEF-003 | Marketplace (buy/sell produce) | Business model complexity |
| DEF-004 | Multi-language Support | Localization complexity |

### Open Technical Questions
| ID | Question |
|----|----------|
| TECH-001 | Prisma connection pooling: PgBouncer vs Prisma Accelerate? |
| TECH-002 | Soft deletes: Prisma extension vs manual `deletedAt` filter? |
| TECH-003 | Push notifications: Expo Push vs Firebase Cloud Messaging? |
| TECH-004 | Image storage: S3 presigned URLs vs local filesystem? |

---

## [MILESTONES] — Verifiable Goals

| Milestone | Goal (Verifiable) | Exit Criteria |
|-----------|-------------------|---------------|
| **M0: Foundation** | Repo scaffolded, CI green, dev env up | `pnpm install && pnpm dev` -> Mobile + API + DB + Redis running; `pnpm test` passes |
| **M1: Auth & Core** | JWT auth working (email/password), RBAC, user CRUD | E2E: Sign up -> Login -> Access protected route; Role guards enforced |
| **M2: Farm & Fields** | Farm CRUD, Field CRUD, basic dashboard | API: Create farm -> Add field -> View dashboard; Mobile: Display farm info |
| **M3: Crops Domain** | Crop lifecycle (plant -> grow -> harvest), activity logging | E2E: Add field -> Plant crop -> Log activity -> Mark harvested |
| **M4: Livestock Domain** | Livestock CRUD, health logs, feed tracking | API: Add animal -> Log vaccination -> Record feeding; Mobile: Display health status |
| **M5: Irrigation & Weather** | Zone management, sensor data display, weather forecast | API: Create zone -> Log sensor data; Mobile: Display weather, irrigation status |
| **M6: Inventory & Finance** | Inventory tracking, transactions, low stock alerts | API: Add item -> Record movement -> View balance; Mobile: Display alerts |
| **M7: Workers & Tasks** | Task management, worker assignment, attendance | E2E: Create task -> Assign worker -> Mark complete |
| **M8: Hardening & Launch** | Load test, security audit, CI/CD, app store prep | API: 500 req/s < 200ms p95; Zero critical vulns; Build submitted to stores |

---

## [CONVENTIONS]

### Git
- **Trunk-based**: `main` only, short-lived feature branches (`feat/*`, `fix/*`)
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- **PRs**: Required reviews (1), CI green, no merge conflicts

### Code Style
- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **ESLint**: `@typescript-eslint/strict`, `eslint-plugin-import` boundaries
- **Prettier**: Single quotes, trailing commas, 100 char width
- **Naming**: PascalCase (types), camelCase (vars), UPPER_SNAKE (constants), kebab-case (files)

### Error Handling
- **Never** throw raw `Error` — use `AppError` subclasses with codes
- **Never** `console.log` — use `logger.info/debug/warn/error` from `@core/logging`
- **API Errors**: Standardized `{ code, message, details? }` via Express error middleware

### Database
- **Migrations only** — no `db push` in CI/prod
- **Naming**: snake_case tables/columns, CUID IDs, `createdAt`/`updatedAt` on all
- **Indexes**: Explicit `@@index` for all query patterns
- **Soft delete**: `deletedAt` DateTime? + Prisma extension filter

### Logging (Protocol 4: Safe Logging)
```typescript
// packages/core/src/logging/index.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: ['req.headers.authorization', '*.password', '*.token', '*.secret'],
  base: { service: 'farm-management', env: process.env.NODE_ENV },
});

// Async, non-blocking — use child loggers for context
export const createChildLogger = (bindings: Record<string, unknown>) => logger.child(bindings);
```

### Testing
- **Unit**: Vitest, co-located `*.test.ts`
- **Integration**: Vitest + Testcontainers (PostgreSQL, Redis)
- **E2E Mobile**: Detox (iOS/Android simulators)
- **Coverage**: 80% lines, 70% branches (enforced in CI)

---

**Status:** M0 scaffold complete. Ready for `pnpm install && docker compose up -d && pnpm dev`.
