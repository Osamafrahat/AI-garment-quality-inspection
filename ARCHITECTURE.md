# Car Rental Management Platform - Architecture Decision Record

## ADR-001: Modular Monolith over Microservices

**Status:** Accepted
**Date:** 2026-07-28

### Context
The project scope includes 5 domains (Fleet, Booking, Billing, Customers, Reports) for an MVP. User initially requested microservices.

### Decision
Start with a **Modular Monolith** using domain-driven package boundaries. Extract to microservices only when justified by:
- Team autonomy needs (separate deploy cadences)
- Scale requirements (different resource profiles per domain)
- Regulatory isolation (PCI scope for billing)

### Consequences
- ✅ Single deployable, simpler operations
- ✅ Shared database, no distributed transactions
- ✅ Type-safe module boundaries via TypeScript paths
- ⚠️ Future extraction requires planning (documented in EXT-001 to EXT-004)

---

## ADR-002: Technology Stack Baseline (2026-07)

**Status:** Accepted
**Date:** 2026-07-28

### Decisions
| Layer | Choice | Version | Rationale |
|-------|--------|---------|-----------|
| Runtime | Node.js | 24 LTS (Krypton) | Active LTS until Oct 2026 |
| Package Manager | pnpm | 9.x | Fast, disk-efficient, monorepo-native |
| Language | TypeScript | 5.6 | Strict mode, modern features |
| Web Framework | Next.js | 15.5 (App Router) | React 19, Turbopack, Server Actions |
| Mobile | Expo | SDK 51 | React Native 0.76, EAS builds |
| Database | PostgreSQL | 17 | JSONB, partitioning, logical replication |
| ORM | Prisma | 7.9 | Adapter-based, no query engine binary |
| Styling | Tailwind CSS | 4.0 | CSS-first config, OKLCH colors |
| Auth | Auth.js | v5 (beta) | React 19 compatible, Edge-ready |
| API Layer | tRPC | 11 | End-to-end type safety |
| State | TanStack Query + Zustand | v5 | Server state + minimal client state |
| Background Jobs | BullMQ | 5.x | Redis-based, reliable queues |
| Observability | Pino + OpenTelemetry | Latest | Structured logging, distributed tracing ready |

### Rejected Alternatives
- **Node 26**: Current release, not LTS
- **Prisma < 7**: Legacy query engine binary
- **Tailwind v3**: Legacy JS config
- **React 18**: End of active support Dec 2024
- **Pages Router**: Legacy Next.js pattern

---

## ADR-003: Database Strategy

**Status:** Accepted
**Date:** 2026-07-28

### Decisions
- **Single PostgreSQL instance** for MVP (shared by all domains)
- **Prisma Migrate** for schema management (`migrate dev` local, `migrate deploy` prod)
- **Connection pooling**: PgBouncer in transaction mode for serverless/production
- **Soft deletes**: `deletedAt` column + Prisma extension middleware
- **Audit logging**: Application-level via middleware (not DB triggers)
- **Multi-tenancy**: Not in MVP (DEC-001), schema designed for future extraction

### Migration Rules
1. Never use `db push` in CI/production
2. Always `migrate dev` locally, commit migration files
3. `migrate deploy` in CI/CD pipeline
4. Backward-compatible migrations only (expand/contract pattern)

---

## ADR-004: API Layer - tRPC + Server Actions

**Status:** Accepted
**Date:** 2026-07-28

### Strategy
- **Web (Next.js)**: Server Actions for mutations, tRPC for queries
- **Mobile (Expo)**: tRPC for all operations
- **Shared contracts**: `@car-rental/api-contracts` package

### Rationale
- End-to-end type safety without code generation
- React 19 Server Actions integration
- Single source of truth for input/output validation (Zod)
- Easy migration to REST/GraphQL if needed

---

## ADR-005: Authentication & Authorization

**Status:** Accepted
**Date:** 2026-07-28

### Decisions
- **Auth.js v5** with Prisma adapter
- **Credentials + OAuth** (Google, Apple) providers
- **JWT sessions** (stateless) with HttpOnly cookies
- **RBAC**: 4 roles (CUSTOMER, STAFF, MANAGER, ADMIN)
- **Permissions**: Fine-grained per-domain (see `packages/auth/src/permissions.ts`)
- **Middleware**: Next.js middleware for route protection

### Security
- Bcrypt (PBKDF2) for password hashing
- CSRF protection via SameSite cookies
- Rate limiting on auth endpoints
- Audit logging for auth events

---

## ADR-006: Observability Foundation

**Status:** Accepted
**Date:** 2026-07-28

### Logging (Protocol 4: Safe Logging)
- **Pino** async logger with redaction
- Levels: fatal, error, warn, info, debug, trace
- Redacted fields: `password`, `token`, `secret`, `authorization`
- Child loggers for context (`logger.child({ userId, requestId })`)

### Metrics
- **Prometheus** `/metrics` endpoint
- Custom business metrics (bookings, revenue, fleet utilization)
- Node.js runtime metrics (event loop, heap, GC)

### Tracing
- **OpenTelemetry** JS SDK configured
- Exporters: OTLP (Tempo/Jaeger)
- Auto-instrumentation for HTTP, DB, Redis

---

## ADR-007: Mobile Architecture

**Status:** Accepted
**Date:** 2026-07-28

### Decisions
- **Expo SDK 51** with Expo Router v4 (file-based routing)
- **Shared types** via `@car-rental/api-contracts`
- **Offline-first**: React Query persist + WatermelonDB (deferred, DEC-003)
- **Push notifications**: Expo Push Service
- **Camera/Location**: Expo SDK modules
- **Builds**: EAS Build for iOS/Android

### Code Sharing Strategy
```
packages/
  api-contracts/     # tRPC routers + Zod schemas (shared)
  core/              # Utils, validation, errors (shared)
apps/
  web/               # Next.js (customers + admin)
  mobile/            # Expo (staff operations)
```

---

## ADR-008: Deployment Strategy

**Status:** Accepted
**Date:** 2026-07-28

### Environments
| Env | Branch | Purpose |
|-----|--------|---------|
| Development | Local | `docker compose up` |
| Preview | PR branches | Vercel/Expo preview deployments |
| Staging | `develop` | Full stack, production-like data |
| Production | `main` | Live traffic |

### CI/CD Pipeline
1. **Lint + Typecheck** (parallel)
2. **Unit/Integration Tests**
3. **Build** all packages + apps
4. **Docker Build** (web + worker)
5. **E2E Tests** (Playwright + Detox)
6. **Deploy** to target environment

### Infrastructure
- **Container**: Docker multi-stage builds (distroless runtime)
- **Orchestration**: Docker Compose (dev), Kubernetes (prod - future)
- **Database**: Managed PostgreSQL (RDS/Cloud SQL)
- **Cache**: Managed Redis (ElastiCache/Cloud Memorystore)
- **Storage**: S3-compatible (MinIO dev, S3/R2 prod)
- **Email**: Mailpit (dev), SendGrid/SES (prod)

---

## Open Decisions (ORPHANS & PENDING)

| ID | Decision | Options | Owner | Due |
|----|----------|---------|-------|-----|
| DEC-001 | Multi-tenancy | Single-tenant MVP vs Multi-tenant schema | Tech Lead | Sprint 0 |
| DEC-002 | Real-time GPS | Polling vs WebSocket vs None | PO | Sprint 1 |
| DEC-003 | Offline Mobile | WatermelonDB vs React Query persist vs None | Mobile Lead | Sprint 1 |
| DEC-004 | Insurance Integration | Manual upload vs Provider API | PO | Sprint 2 |
| TECH-001 | Prisma Pooling | PgBouncer vs Prisma Accelerate | Backend Lead | Sprint 0 |
| TECH-002 | Soft Deletes | Prisma extension vs manual `deletedAt` | Backend Lead | Sprint 0 |
| TECH-003 | Audit Logging | Middleware vs DB triggers vs App layer | Backend Lead | Sprint 0 |