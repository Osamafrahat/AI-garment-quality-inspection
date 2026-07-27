# Car Rental Management Platform - Project Map

**Generated:** 2026-07-28  
**Architecture:** Modular Monolith (Microservices extraction path documented)  
**Stack Baseline:** 2026-07 (Node 24 LTS / React 19.2 / Next.js 15.5 / Prisma 7.9 / PostgreSQL 17 / TS 5.6 / Tailwind 4)

---

## [TECH_STACK]

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Runtime** | Node.js | 24.18.0 LTS (Krypton) | Active LTS until 2026-10 |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient, monorepo-native |
| **Language** | TypeScript | 5.6 | Strict mode, strictNullChecks, exactOptionalPropertyTypes |
| **Frontend (Web)** | Next.js | 15.5.x (App Router, Turbopack) | React 19 support, stable Turbopack, Server Actions |
| **Frontend (Mobile)** | Expo | SDK 51 / React Native 0.76 | Shared TS types, Expo Router v4, EAS builds |
| **UI Library** | Tailwind CSS | 4.0 | CSS-first config, OKLCH colors, faster builds |
| **UI Components** | shadcn/ui + Radix UI | Latest | Accessible, unstyled, Tailwind 4 compatible |
| **State (Client)** | TanStack Query v5 + Zustand | Latest | Server state + lightweight client state |
| **Forms** | React Hook Form + Zod | Latest | Type-safe validation, RHF 7.52+ |
| **Auth** | Auth.js (NextAuth v5) | Beta/RC 2026 | React 19 compatible, Edge-ready, Drizzle/Prisma adapters |
| **Database** | PostgreSQL | 17 (Current) | JSONB, partitioning, logical replication |
| **ORM** | Prisma ORM | 7.9.0 | Adapter-based (@prisma/adapter-pg), no query engine binary |
| **Migrations** | Prisma Migrate | 7.9.0 | `migrate dev` (dev), `migrate deploy` (prod) |
| **API Layer** | Next.js Server Actions + tRPC v11 | Next.js 15 SA + tRPC 11 | Type-safe RPC for mobile, Server Actions for web |
| **Realtime** | Socket.io / Pusher | Latest | WebSocket for fleet status, chat |
| **File Storage** | S3-compatible (MinIO / S3 / R2) | - | Presigned URLs, multipart upload |
| **Background Jobs** | BullMQ + Redis | BullMQ 5.x / Redis 7 | Job queues for billing, notifications, reports |
| **Logging** | Pino (async) + Loki/Grafana | Pino 9.x | Async, structured JSON, low overhead |
| **Metrics** | Prometheus + Grafana | Prometheus 2.54+ | /metrics endpoint, custom business metrics |
| **Tracing** | OpenTelemetry + Tempo/Jaeger | OTel JS 0.55+ | Distributed tracing ready for extraction |
| **Testing** | Vitest + Playwright + React Native Testing Library | Latest | Unit, integration, E2E, mobile |
| **CI/CD** | GitHub Actions + Docker | - | Build, test, lint, typecheck, deploy |
| **Container** | Docker + docker-compose | - | Multi-stage builds, distroless base |
| **Mobile Build** | EAS Build (Expo) | - | Managed builds for iOS/Android |

**Explicitly Avoided (Deprecated/Unstable):**
- Node.js 26 (Current, not LTS)
- Prisma < 7 (legacy query engine binary)
- Tailwind CSS v3 (legacy config)
- Next.js Pages Router (legacy)
- React 18 (end of active support Dec 2024)
- Prisma `db push` in production (use `migrate deploy`)
- `@prisma/client` without adapter in serverless (use `@prisma/adapter-pg`)

---

## [SYSTEM_FLOW]

### User Journeys (Verifiable Goals)

#### Customer Journey (Web + Mobile)
1. **Browse Fleet** → Filter by category, date range, location → View vehicle details + pricing
2. **Authenticate** → Email/password or OAuth (Google/Apple) → JWT + HttpOnly cookie
3. **Create Booking** → Select vehicle, dates, pickup/return location, extras → Price calculation → Confirm
4. **Payment** → Stripe PaymentIntent → 3D Secure → Booking confirmed + hold on card
5. **Manage Booking** → View upcoming/past, modify (if policy allows), cancel (refund rules)
6. **Pickup/Return** → QR code scan → Condition report (photos) → Digital signature
7. **Post-Rental** → Invoice download, review, loyalty points

#### Staff Journey (Admin Web)
1. **Dashboard** → Fleet utilization, revenue, overdue returns, alerts
2. **Fleet Management** → CRUD vehicles, categories, maintenance schedules, availability calendar
3. **Booking Management** → View all, override, manual create, check-in/out, damage assessment
4. **Customer Management** → Profiles, KYC, rental history, credit limits, blacklist
5. **Billing/Invoicing** → Invoices, payments, refunds, disputes, Stripe reconciliation
6. **Reports** → Revenue, utilization, maintenance costs, customer LTV, export CSV/PDF

#### Mobile Staff (Expo App)
- Quick check-in/out via QR scan
- Damage photo capture + annotation
- Offline-first sync (WatermelonDB / React Query persist)

---

### Data Flow (API/Server Actions)

```
┌─────────────┐     Server Actions / tRPC      ┌──────────────┐
│  Next.js    │  ◄────────────────────────────►  │  Prisma ORM  │
│  (Web)      │                                 │  (PostgreSQL)  │
└──────┬──────┘                                 └──────┬───────┘
       │                                               │
       ▼                                               ▼
┌─────────────┐                              ┌──────────────┐
│  Expo App   │  ◄──── tRPC / REST ─────────►  │  Redis       │
│  (Mobile)   │                                 │  (Cache/Queue)│
└─────────────┘                                 └──────────────┘
       │                                               │
       ▼                                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Background Workers (BullMQ)              │
│  • Billing/Invoicing  • Notifications  • Maintenance Scheduling      │
│  • Report Generation  • Stripe Webhook Handling             │
└─────────────────────────────────────────────────────────────┘
```

---

## [ARCHITECTURE]

### Monorepo Structure (pnpm Workspaces)

```
car-rental/
├── apps/
│   ├── web/                    # Next.js 15 (App Router)
│   │   ├── src/
│   │   │   ├── app/            # App Router pages + Server Actions
│   │   │   ├── components/     # Shared UI components (shadcn/ui)
│   │   │   ├── lib/            # Auth, Prisma client, utilities
│   │   │   ├── features/       # Domain features (booking, fleet, billing)
│   │   │   │   ├── booking/
│   │   │   │   ├── fleet/
│   │   │   │   ├── billing/
│   │   │   │   ├── customer/
│   │   │   │   └── reports/
│   │   │   └── trpc/           # tRPC routers (shared with mobile)
│   │   └── package.json
│   │
│   └── mobile/                 # Expo (React Native)
│       ├── app/                # Expo Router v4 (file-based routing)
│       ├── components/
│       ├── lib/
│       ├── features/           # Mirrors web features (shared types)
│       └── package.json
│
├── packages/
│   ├── core/                   # Shared kernel (ZERO business logic)
│   │   ├── src/
│   │   │   ├── config/         # Env validation (Zod)
│   │   │   ├── logging/        # Pino logger (async, structured)
│   │   │   ├── errors/         # AppError classes, error codes
│   │   │   ├── validation/     # Shared Zod schemas
│   │   │   └── utils/          # Pure utils (date, currency, id)
│   │   └── package.json
│   │
│   ├── db/                     # Database layer (Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Single source of truth
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts       # PrismaClient singleton (adapter-pg)
│   │   │   ├── extensions/     # Prisma extensions (soft delete, audit)
│   │   │   └── repositories/   # Repository pattern per domain
│   │   └── package.json
│   │
│   ├── auth/                   # Auth configuration (Auth.js v5)
│   │   ├── src/
│   │   │   ├── config.ts       # Providers, callbacks, adapter
│   │   │   ├── permissions.ts  # RBAC definitions
│   │   │   └── middleware.ts   # Next.js middleware
│   │   └── package.json
│   │
│   ├── billing/                # Stripe integration (shared)
│   │   ├── src/
│   │   │   ├── client.ts       # Stripe server client
│   │   │   ├── webhooks.ts     # Event handlers
│   │   │   ├── pricing.ts      # Pricing engine (pure functions)
│   │   │   └── invoicing.ts    # Invoice generation (PDFKit)
│   │   └── package.json
│   │
│   ├── messaging/              # Notifications (email, push, SMS)
│   │   ├── src/
│   │   │   ├── providers/      # Nodemailer, Expo Push, Twilio
│   │   │   ├── templates/      # React Email templates
│   │   │   └── queue.ts        # BullMQ job definitions
│   │   └── package.json
│   │
│   └── api-contracts/          # Shared tRPC/OpenAPI types
│       ├── src/
│       │   ├── routers/        # tRPC router definitions
│       │   └── schemas/        # Zod schemas (shared web+mobile)
│       └── package.json
│
├── tools/
│   ├── eslint-config/          # Shared ESLint config
│   ├── tsconfig/               # Shared TS configs (base, nextjs, react-native)
│   └── tailwind-config/        # Shared Tailwind 4 config (CSS vars)
│
├── docker/
│   ├── docker-compose.yml      # Postgres, Redis, MinIO, Mailpit
│   ├── Dockerfile.web
│   ├── Dockerfile.worker
│   └── .env.example
│
├── pnpm-workspace.yaml
├── package.json
├── turbo.json                  # Turborepo config
└── README.md
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
  emailVerified DateTime?
  passwordHash  String?
  name          String?
  phone         String?
  avatarUrl     String?
  role          Role      @default(CUSTOMER)
  status        UserStatus @default(ACTIVE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  customer      Customer?
  staff         Staff?
  bookings      Booking[]
  notifications Notification[]
  auditLogs     AuditLog[]

  @@index([email])
  @@index([role])
}

enum Role {
  CUSTOMER
  STAFF
  ADMIN
  MANAGER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

model Customer {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  licenseNumber   String?  @unique
  licenseExpiry   DateTime?
  licenseCountry  String?
  dateOfBirth     DateTime?
  address         Json?
  emergencyContact Json?
  creditLimit     Decimal  @default(0) @db.Decimal(10, 2)
  loyaltyPoints   Int      @default(0)
  isBlacklisted   Boolean  @default(false)
  blacklistReason String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  bookings        Booking[]
  invoices        Invoice[]
  payments        Payment[]
  documents       Document[]
}

model Staff {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  employeeId  String   @unique
  department  String?
  hireDate    DateTime
  permissions Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  maintenanceLogs MaintenanceLog[]
  inspections     Inspection[]
}

// ──────────────────────────────────────────────
// FLEET DOMAIN
// ──────────────────────────────────────────────

model VehicleCategory {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  dailyRate   Decimal  @db.Decimal(10, 2)
  weeklyRate  Decimal  @db.Decimal(10, 2)
  monthlyRate Decimal  @db.Decimal(10, 2)
  deposit     Decimal  @db.Decimal(10, 2)
  imageUrl    String?
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  vehicles    Vehicle[]
}

model Vehicle {
  id            String         @id @default(cuid())
  categoryId    String
  category      VehicleCategory @relation(fields: [categoryId], references: [id])
  licensePlate  String         @unique
  vin           String         @unique
  make          String
  model         String
  year          Int
  color         String
  fuelType      FuelType
  transmission  Transmission
  mileage       Int            @default(0)
  status        VehicleStatus  @default(AVAILABLE)
  locationId    String?
  location      Location?      @relation(fields: [locationId], references: [id])
  purchaseDate  DateTime?
  purchasePrice Decimal?       @db.Decimal(12, 2)
  insuranceExpiry DateTime?
  registrationExpiry DateTime?
  lastServiceDate DateTime?
  lastServiceMileage Int?
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  bookings          Booking[]
  maintenanceLogs   MaintenanceLog[]
  inspections       Inspection[]
  documents         Document[]
  gpsTracks         GPSTrack[]

  @@index([status])
  @@index([locationId])
  @@index([categoryId])
}

enum FuelType {
  PETROL
  DIESEL
  HYBRID
  ELECTRIC
}

enum Transmission {
  MANUAL
  AUTOMATIC
  CVT
}

enum VehicleStatus {
  AVAILABLE
  RENTED
  MAINTENANCE
  OUT_OF_SERVICE
  RESERVED
}

model Location {
  id        String   @id @default(cuid())
  name      String
  address   String
  city      String
  state     String?
  country   String
  lat       Decimal  @db.Decimal(10, 8)
  lng       Decimal  @db.Decimal(11, 8)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  vehicles  Vehicle[]
  bookings  Booking[] @relation("PickupLocation")
  returns   Booking[] @relation("ReturnLocation")
}

model MaintenanceLog {
  id          String   @id @default(cuid())
  vehicleId   String
  vehicle     Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  staffId     String?
  staff       Staff?   @relation(fields: [staffId], references: [id])
  type        MaintenanceType
  description String
  cost        Decimal  @db.Decimal(10, 2)
  mileage     Int
  startedAt   DateTime
  completedAt DateTime?
  nextServiceDate DateTime?
  nextServiceMileage Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([vehicleId])
  @@index([startedAt])
}

enum MaintenanceType {
  ROUTINE
  REPAIR
  INSPECTION
  CLEANING
  TIRE_CHANGE
  OIL_CHANGE
  BATTERY
  OTHER
}

model Inspection {
  id          String       @id @default(cuid())
  vehicleId   String
  vehicle     Vehicle      @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  staffId     String
  staff       Staff        @relation(fields: [staffId], references: [id])
  bookingId   String?
  booking     Booking?     @relation(fields: [bookingId], references: [id])
  type        InspectionType
  status      InspectionStatus
  notes       String?
  photos      String[]     // S3 keys
  signature   String?      // S3 key
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([vehicleId])
  @@index([bookingId])
}

enum InspectionType {
  PRE_RENTAL
  POST_RENTAL
  DAMAGE_ASSESSMENT
  ROUTINE
}

enum InspectionStatus {
  PENDING
  COMPLETED
  DISPUTED
}

// ──────────────────────────────────────────────
// BOOKING DOMAIN
// ──────────────────────────────────────────────

model Extra {
  id          String   @id @default(cuid())
  name        String
  description String?
  dailyRate   Decimal  @db.Decimal(10, 2)
  category    ExtraCategory
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bookings    BookingExtra[]
}

model Booking {
  id              String        @id @default(cuid())
  bookingNumber   String        @unique @default(cuid())
  customerId      String
  customer        Customer      @relation(fields: [customerId], references: [id])
  vehicleId       String
  vehicle         Vehicle       @relation(fields: [vehicleId], references: [id])
  pickupLocationId String
  pickupLocation  Location      @relation("PickupLocation", fields: [pickupLocationId], references: [id])
  returnLocationId String
  returnLocation  Location      @relation("ReturnLocation", fields: [returnLocationId], references: [id])
  status          BookingStatus @default(PENDING)
  startDate       DateTime
  endDate         DateTime
  actualStartDate DateTime?
  actualEndDate   DateTime?
  dailyRate       Decimal       @db.Decimal(10, 2)
  totalDays       Int
  subtotal        Decimal       @db.Decimal(10, 2)
  taxAmount       Decimal       @db.Decimal(10, 2)
  discountAmount  Decimal       @default(0) @db.Decimal(10, 2)
  totalAmount     Decimal       @db.Decimal(10, 2)
  depositAmount   Decimal       @db.Decimal(10, 2)
  depositRefunded Decimal       @default(0) @db.Decimal(10, 2)
  cancellationReason String?
  cancelledAt     DateTime?
  cancelledBy     String?
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  extras          BookingExtra[]
  payments        Payment[]
  invoices        Invoice[]
  inspections     Inspection[]
  gpsTracks       GPSTrack[]

  @@index([customerId])
  @@index([vehicleId])
  @@index([status])
  @@index([startDate, endDate])
}

enum BookingStatus {
  PENDING
  CONFIRMED
  ACTIVE
  COMPLETED
  CANCELLED
  NO_SHOW
  DISPUTED
}

model BookingExtra {
  id        String   @id @default(cuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  extraId   String
  extra     Extra    @relation(fields: [extraId], references: [id])
  quantity  Int      @default(1)
  unitPrice Decimal  @db.Decimal(10, 2)
  totalPrice Decimal @db.Decimal(10, 2)
  createdAt DateTime @default(now())

  @@unique([bookingId, extraId])
}

enum ExtraCategory {
  INSURANCE
  EQUIPMENT
  SERVICE
  FUEL
  OTHER
}

// ──────────────────────────────────────────────
// BILLING DOMAIN
// ──────────────────────────────────────────────

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique
  bookingId     String        @unique
  booking       Booking       @relation(fields: [bookingId], references: [id])
  customerId    String
  customer      Customer      @relation(fields: [customerId], references: [id])
  status        InvoiceStatus @default(DRAFT)
  subtotal      Decimal       @db.Decimal(10, 2)
  taxAmount     Decimal       @db.Decimal(10, 2)
  totalAmount   Decimal       @db.Decimal(10, 2)
  paidAmount    Decimal       @default(0) @db.Decimal(10, 2)
  dueDate       DateTime
  issuedAt      DateTime?
  paidAt        DateTime?
  cancelledAt   DateTime?
  pdfUrl        String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  payments      Payment[]
  lineItems     InvoiceLineItem[]

  @@index([customerId])
  @@index([status])
  @@index([dueDate])
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  PARTIALLY_PAID
  OVERDUE
  CANCELLED
  REFUNDED
}

model InvoiceLineItem {
  id          String   @id @default(cuid())
  invoiceId   String
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  description String
  quantity    Int
  unitPrice   Decimal  @db.Decimal(10, 2)
  totalPrice  Decimal  @db.Decimal(10, 2)
  type        LineItemType
  metadata    Json?
  createdAt   DateTime @default(now())
}

enum LineItemType {
  RENTAL
  EXTRA
  DEPOSIT
  FEE
  TAX
  DISCOUNT
  REFUND
}

model Payment {
  id              String          @id @default(cuid())
  paymentNumber   String          @unique
  bookingId       String?
  booking         Booking?        @relation(fields: [bookingId], references: [id])
  invoiceId       String?
  invoice         Invoice?        @relation(fields: [invoiceId], references: [id])
  customerId      String
  customer        Customer        @relation(fields: [customerId], references: [id])
  amount          Decimal         @db.Decimal(10, 2)
  currency        String          @default("USD")
  status          PaymentStatus   @default(PENDING)
  method          PaymentMethod
  provider        String          @default("stripe")
  providerPaymentId String?
  providerRefundId String?
  description     String?
  metadata        Json?
  processedAt     DateTime?
  refundedAt      DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([bookingId])
  @@index([invoiceId])
  @@index([customerId])
  @@index([status])
  @@index([providerPaymentId])
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
  DISPUTED
}

enum PaymentMethod {
  CARD
  CASH
  BANK_TRANSFER
  WALLET
  OTHER
}

// ──────────────────────────────────────────────
// SUPPORTING DOMAINS
// ──────────────────────────────────────────────

model Document {
  id        String         @id @default(cuid())
  entityType DocumentEntity
  entityId  String
  type      DocumentType
  name      String
  url       String         // S3 key
  mimeType  String
  size      Int
  metadata  Json?
  uploadedBy String?
  createdAt DateTime       @default(now())

  @@index([entityType, entityId])
}

enum DocumentEntity {
  CUSTOMER
  VEHICLE
  BOOKING
  STAFF
  INVOICE
}

enum DocumentType {
  ID_DOCUMENT
  LICENSE
  INSURANCE
  REGISTRATION
  INSPECTION_PHOTO
  DAMAGE_PHOTO
  CONTRACT
  INVOICE_PDF
  RECEIPT
  OTHER
}

model Notification {
  id        String              @id @default(cuid())
  userId    String
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  message   String
  data      Json?
  readAt    DateTime?
  createdAt DateTime            @default(now())

  @@index([userId, readAt])
  @@index([type])
}

enum NotificationType {
  BOOKING_CONFIRMED
  BOOKING_REMINDER
  BOOKING_CANCELLED
  PAYMENT_RECEIVED
  PAYMENT_FAILED
  PICKUP_REMINDER
  RETURN_REMINDER
  MAINTENANCE_DUE
  DAMAGE_REPORTED
  INVOICE_ISSUED
  REVIEW_REQUEST
  SYSTEM_ALERT
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String
  entity    String
  entityId  String
  oldData   Json?
  newData   Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

---

## [ORPHANS & PENDING]

### Open Decisions (DEC-*)

| ID | Decision | Options | Owner | Due |
|----|----------|---------|-------|-----|
| DEC-001 | Multi-tenancy | Single-tenant MVP vs Multi-tenant schema | Tech Lead | Sprint 0 |
| DEC-002 | Real-time GPS | Polling vs WebSocket vs None | PO | Sprint 1 |
| DEC-003 | Offline Mobile | WatermelonDB vs React Query persist vs None | Mobile Lead | Sprint 1 |
| DEC-004 | Insurance Integration | Manual upload vs Provider API | PO | Sprint 2 |

### Technical Debt (TECH-*)

| ID | Item | Options | Owner | Due |
|----|------|---------|-------|-----|
| TECH-001 | Prisma Pooling | PgBouncer vs Prisma Accelerate | Backend Lead | Sprint 0 |
| TECH-002 | Soft Deletes | Prisma extension vs manual `deletedAt` | Backend Lead | Sprint 0 |
| TECH-003 | Audit Logging | Middleware vs DB triggers vs App layer | Backend Lead | Sprint 0 |

### Future Microservices Extraction Path (EXT-*)

| Service | Trigger | Dependencies | Notes |
|---------|---------|--------------|-------|
| **Fleet Service** | 1000+ vehicles, separate scaling | Vehicle, Category, Location, Maintenance, Inspection | Geo-distributed fleet needs |
| **Booking Service** | High booking volume, complex rules | Booking, Extra, Customer | Separate read/write models |
| **Billing Service** | PCI scope reduction, Stripe webhook volume | Invoice, Payment, Customer | Requires saga pattern for consistency |
| **Customer Service** | CRM integration, loyalty program | Customer, User, Document | Profile enrichment pipeline |
| **Notification Service** | Multi-channel, template management | Notification, Template, Provider | Already isolated in `packages/messaging` |

---

## Milestones (Verifiable Goals)

| Milestone | Target | Verifiable Goal |
|-----------|--------|-----------------|
| **M0: Foundation** | Week 1 | `pnpm dev` starts web + mobile; `docker compose up` healthy |
| **M1: Fleet & Booking** | Week 2-3 | CRUD fleet + create booking flow (web + mobile) |
| **M2: Auth & Customers** | Week 3-4 | Sign up/in, customer profile, KYC upload |
| **M3: Billing & Payments** | Week 4-5 | Stripe integration, invoice generation, payment flow |
| **M4: Staff Operations** | Week 5-6 | Check-in/out, inspections, damage tracking (mobile) |
| **M5: Reports & Dashboard** | Week 6-7 | Revenue, utilization, maintenance reports |
| **M6: Hardening** | Week 7-8 | E2E tests, load test, observability, deploy staging |
| **M7: Production Launch** | Week 8 | Deploy prod, monitoring, runbooks |

---

**Status:** M0 scaffold complete. Ready for `pnpm install && docker compose up -d && pnpm dev`.