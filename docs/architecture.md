# CNBS Dashboard Architecture

## Objective

Build a high-criticality institutional dashboard for CNBS that ingests manually uploaded Excel workbooks, validates and normalizes them offline, reconciles them against an official reference workbook, and publishes immutable dataset versions consumed by a fast public runtime.

Phase 1 operational truth:

- `primas.xlsx` is the primary source for premiums only.
- `estado_situacion_financiera.xlsx` is the primary source for balance sheet / statement of financial position.
- `informe_financiero_referencia.xlsx` is a reference workbook for formulas, presentation logic, reconciliation, rankings, and validation only.
- Claims and income statement official publications are blocked until an additional authoritative raw feed is available.

## Architectural Principles

- Never read Excel files in public request paths.
- Treat every workbook as untrusted input.
- Detect workbook role by schema, not by filename.
- Publish dataset versions atomically.
- Keep the last valid dataset active when a new ingestion fails.
- Derive all public metrics from the canonical model, not from UI code.
- Keep public read plane separated from private administrative write plane.
- Preserve traceability, auditability, and reproducibility for every ingestion run.

## High-Level Topology

```text
Manual Upload -> Admin API -> Quarantine Storage -> ETL Pipeline -> Staging Dataset
                                                    |-> Validation
                                                    |-> Normalization
                                                    |-> Reconciliation
                                                    |-> Build Aggregates
                                                    |-> Publish Immutable Version

Published Version -> Active Version Pointer -> Public Read API -> Public Next.js Web
                                        \-> Admin UI / Audit UI
```

## Monorepo Layout

```text
apps/
  admin/        # private Next.js UI for upload, validation, publish, rollback, audit
  api/          # Fastify server exposing public read APIs and private admin APIs
  web/          # public Next.js site
packages/
  charts/       # chart configs and wrappers for financial visuals
  config/       # shared TS, lint, formatting, env, runtime config
  domain/       # domain types, entities, enums, policies
  etl/          # workbook detection, parsing, normalization, reconciliation, publish
  schemas/      # zod schemas and contracts
  testing/      # fixtures, builders, shared test helpers
  ui/           # shared UI components and tokens
docs/
  ...
storage/
  quarantine/
  staging/
  published/
  active/
  audit/
```

`apps/api` is added in addition to the requested suggested structure to enforce a stronger separation between frontend apps and API planes.

## Planes and Responsibilities

### Public Read Plane

- `apps/web`
- public routes only
- consumes precomputed published datasets via public API
- never parses raw Excel
- optimized for caching, low latency, and resilience

### Private Admin Plane

- `apps/admin`
- authenticated and RBAC protected
- upload, validation review, reconciliation review, publish, rollback, audit

### API Plane

- `apps/api`
- public read endpoints under `/api/public/*`
- private admin endpoints under `/api/admin/*`
- health, readiness, audit, and status endpoints

### ETL / Worker Plane

- `packages/etl`
- offline/background processing only
- workbook classification, extraction, validation, normalization, reconciliation, artifact generation, publish, rollback metadata updates

## Storage Design

Phase 1 uses file-system backed adapters with clean abstractions so the persistence layer can later move to managed storage and databases.

### Logical Stores

- `quarantine`: uploaded workbooks before trust checks complete
- `staging`: extracted structured data, intermediate validation outputs
- `published`: immutable canonical datasets and derived assets by version
- `active`: active-version pointer and lightweight metadata for fast reads
- `audit`: append-only audit events and ingestion reports

### Version Layout

```text
storage/
  published/
    dataset-2026-03-13T153000Z-1a2b3c4d/
      manifest.json
      metadata.json
      catalogs/
      facts/
      aggregates/
      reports/
```

## Publication Model

1. Upload workbooks into quarantine.
2. Detect workbook roles by signatures.
3. Parse into staging records.
4. Validate structure and data quality.
5. Normalize institutions, accounts, ramos, currencies, and text.
6. Reconcile against the reference workbook where rules apply.
7. Materialize the canonical dataset and all derived aggregates.
8. Write immutable version under `storage/published/<dataset-version>/`.
9. Atomically switch `storage/active/active-dataset.json` to the new version.
10. Invalidate caches / trigger revalidation.

If any critical stage fails, the active pointer is not changed.

## Atomicity Strategy

- Publish work happens in a temporary version directory first.
- Manifest hash and metadata are generated after all files are written.
- Only after successful completion is `active-dataset.json` replaced.
- The pointer file is the single activation switch.
- Rollback means setting the pointer back to an already-published immutable version.

## Failure Handling

- Upload failure: request rejected, no impact on active dataset.
- Parse failure: ingestion marked failed, report persisted, no impact on active dataset.
- Validation critical failure: publication aborted, active dataset preserved.
- Reconciliation critical failure: publication aborted, active dataset preserved.
- Cache invalidation failure: log and retry; public runtime still serves previous active pointer until explicitly switched.

## Security Boundaries

- Workbooks are untrusted binary inputs.
- No macro, VBA, or formula execution.
- Only `.xlsx` accepted in phase 1.
- Role-based access control on admin endpoints.
- Public APIs are read-only.
- Private APIs are authenticated and rate-limited.
- Uploaded strings are sanitized before persistence or rendering.

## Runtime Efficiency

- Public API reads only compact JSON metadata and precomputed aggregates.
- Large analytical tables are paginated or virtualized.
- Dataset-level expensive calculations are precomputed during ETL.
- UI charts operate on derived published views.

## Deployment Modes

### Local Development

- file-system storage adapters
- local auth stub / header-based dev auth
- inline job execution or local async jobs

### Future Managed Mode

- object storage adapter for S3-compatible systems
- database adapter for PostgreSQL
- queue adapter for Redis/BullMQ
- external OIDC identity provider

## Non-Goals in Phase 1

- automated scraping or scheduled workbook downloads
- official publication of claims and income statement from non-authoritative sources
- true streaming ingestion
