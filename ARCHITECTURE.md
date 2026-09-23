# ThreadSight — AI Garment Quality Inspection · Architecture Decision Record

## ADR-001: Edge-first inspection over camera-to-cloud

**Status:** Accepted  
**Date:** 2026-09-23

### Context
Capstone Pathway A (Industrial Base) requires measurable response time and accuracy for garment defect decisions on the factory floor.

### Decision
Run inference and decisioning on **Raspberry Pi 5** firmware (`capstone/firmware`), post results to a local **FastAPI gateway** (`capstone/gateway`), and surface live verdicts in a **Next.js dashboard** (`apps/web/inspection`).

### Consequences
- ✅ Sub-second edge latency and offline-capable decisions
- ✅ Demoable input→output change (threshold θ, demo PASS/FAIL buttons)
- ⚠️ Single-node deployment; scale-out path documented in system architecture docs

---

## ADR-002: Technology stack baseline

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Edge runtime | Python 3 on Raspberry Pi 5 | Camera/sensor libs + ML runtime |
| Model | sklearn/MLP pipeline in `capstone/ml` | 90% held-out accuracy evidence |
| Gateway | FastAPI + SQLite | Fast local API, simple exhibition setup |
| Dashboard | Next.js 15 + React 19 | Live inspection UI at `/inspection` |
| Monorepo | pnpm + turbo | Shared packages under `packages/` |

---

## ADR-003: Decision threshold as the DR demo

**Status:** Accepted

Exposing θ (decision threshold) on the dashboard lets examiners change input and observe PASS/FAIL output flips — required exhibition behavior (DR demonstration, test plan §4.1).

---

## ADR-004: Shared contracts package

- **Shared types/schemas**: `@threadsight/api-contracts`
- **Utilities**: `@threadsight/core`
- Web app name: `@threadsight/web`

---

## ADR-005: Observability

- Structured logging via Pino (`service: threadsight`)
- Gateway telemetry: `/api/v1/stats`, `/api/v1/telemetry`, SSE `/api/v1/stream`
- Latency metrics: edge p95 and e2e estimate on inspection records

---

## Open decisions

| ID | Decision | Options | Due |
|----|----------|---------|-----|
| DEC-001 | Production DB | SQLite MVP vs PostgreSQL | After exhibition |
| DEC-002 | Auth | None (exhibition) vs Auth.js | Out of capstone scope |
| DEC-003 | Mobile staff app | Expo shell vs drop | Optional |
