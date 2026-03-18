# Local Operations Guide

## Services

- Public web: `http://localhost:3000`
- Admin web: `http://localhost:3001`
- API: `http://localhost:4000`

## Local Credentials

Taken from `.env.example`:

- User: `admin`
- Password: `change-me`
- Admin API secret: `local-dev-secret`

## Display Timezone

- default display timezone: `America/Tegucigalpa`
- default locale: `es-HN`
- internal timestamps remain UTC; UI renders a localized representation

## Public Routes

| Route | File | Purpose | Data Source |
|---|---|---|---|
| `/` | `apps/web/app/page.tsx` | Executive dashboard home | `GET /api/public/overview` |
| `/rankings` | `apps/web/app/rankings/page.tsx` | Institutional rankings | `GET /api/public/rankings` |
| `/version` | `apps/web/app/version/page.tsx` | Active dataset metadata | `GET /api/public/version` |
| `/institutions/[institutionId]` | `apps/web/app/institutions/[institutionId]/page.tsx` | Institution detail page | `GET /api/public/institutions/:institutionId` |

## Admin Routes

| Route | File | Login Required | Purpose |
|---|---|---:|---|
| `/` | `apps/admin/app/page.tsx` | No | Login screen |
| `/login` | `apps/admin/app/login/page.tsx` | No | Login alias redirect |
| `/admin` | `apps/admin/app/admin/page.tsx` | Yes | Admin entry redirect to upload |
| `/upload` | `apps/admin/app/(admin)/upload/page.tsx` | Yes | Upload workbook set |
| `/ingestions` | `apps/admin/app/(admin)/ingestions/page.tsx` | Yes | List staged ingestion runs |
| `/reconciliation` | `apps/admin/app/(admin)/reconciliation/page.tsx` | Yes | Review latest staged run |
| `/publish` | `apps/admin/app/(admin)/publish/page.tsx` | Yes | Publish staged run |
| `/publications` | `apps/admin/app/(admin)/publications/page.tsx` | Yes | Published versions and rollback |
| `/history` | `apps/admin/app/(admin)/history/page.tsx` | Yes | Version history |
| `/audit` | `apps/admin/app/(admin)/audit/page.tsx` | Yes | Audit events |

Admin entry URL:

- Recommended: `http://localhost:3001/`
- After login, operational entry: `http://localhost:3001/admin`

## API Endpoints

### Public

| Method | Route | File | Purpose | Storage Used |
|---|---|---|---|---|
| `GET` | `/health/live` | `apps/api/src/routes/health/index.ts` | Liveness | none |
| `GET` | `/health/ready` | `apps/api/src/routes/health/index.ts` | Readiness | service init |
| `GET` | `/api/public/version` | `apps/api/src/routes/public/index.ts` | Active dataset metadata | `storage/active/active-dataset.json`, `storage/published/*/metadata.json` |
| `GET` | `/api/public/overview` | `apps/api/src/routes/public/index.ts` | Home payload | `metadata.json`, `aggregates/*.json`, `facts/*.json`, `catalogs/*.json` |
| `GET` | `/api/public/premiums/institutions` | `apps/api/src/routes/public/index.ts` | Premium table | `aggregates/premiums-by-institution.json` |
| `GET` | `/api/public/premiums/lines` | `apps/api/src/routes/public/index.ts` | Premium by line | `aggregates/premiums-by-line.json` |
| `GET` | `/api/public/financial/institutions` | `apps/api/src/routes/public/index.ts` | Financial highlights table | `aggregates/financial-highlights.json` |
| `GET` | `/api/public/rankings` | `apps/api/src/routes/public/index.ts` | Rankings | `aggregates/rankings.json` |
| `GET` | `/api/public/institutions/:institutionId` | `apps/api/src/routes/public/index.ts` | Institution detail payload | `catalogs/institutions.json`, `facts/*.json`, `aggregates/*.json` |

### Private

| Method | Route | File | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/system/status` | `apps/api/src/routes/admin/index.ts` | Active dataset + counters |
| `GET` | `/api/admin/ingestions` | `apps/api/src/routes/admin/index.ts` | List staged runs |
| `POST` | `/api/admin/ingestions` | `apps/api/src/routes/admin/index.ts` | Upload workbook set and create staging run |
| `POST` | `/api/admin/publications/:ingestionRunId/publish` | `apps/api/src/routes/admin/index.ts` | Publish staged run |
| `POST` | `/api/admin/publications/:datasetVersionId/rollback` | `apps/api/src/routes/admin/index.ts` | Roll back active dataset |
| `GET` | `/api/admin/publications` | `apps/api/src/routes/admin/index.ts` | List published versions |
| `GET` | `/api/admin/audit` | `apps/api/src/routes/admin/index.ts` | Audit event list |

## Shared Storage Paths

All services use the workspace-root storage:

- `storage/quarantine/`
- `storage/staging/`
- `storage/published/`
- `storage/active/active-dataset.json`
- `storage/audit/`

## Start Services

Open three terminals from the repo root.

### Terminal 1

```bash
corepack pnpm --filter @cnbs/api dev
```

### Terminal 2

```bash
corepack pnpm --filter @cnbs/web dev
```

### Terminal 3

```bash
corepack pnpm --filter @cnbs/admin dev
```

## End-to-End Flow

### Step 1: Login

- URL: `http://localhost:3001/`
- Action: enter `admin` / `change-me`
- Result: redirect to `/upload`

### Step 2: Upload Workbooks

- URL: `http://localhost:3001/upload`
- Action: upload:
- premiums workbook (optional primary)
- financial position workbook (optional primary)
- income statement workbook (detectable, but non-operational for public publication)
  - `informe_financiero_referencia.xlsx` (optional reference)
- API: `POST /api/admin/ingestions`
- Result:
  - files copied to `storage/quarantine/`
  - staged run written to `storage/staging/<ingestionRunId>.json`

Important:

- at least one primary workbook must be present
- reference workbook alone is not enough to publish
- workbook names may change; classification is based on structure and semantic content

### Step 3: Review Staging

- URL: `http://localhost:3001/ingestions`
- API: `GET /api/admin/ingestions`
- Result: you see the staged run, validation publishability, reconciliation publishability

### Step 4: Review Validation and Reconciliation

- URL: `http://localhost:3001/reconciliation`
- API: `GET /api/admin/ingestions`
- Result: latest run JSON shown for operational review

### Step 5: Publish

- URL: `http://localhost:3001/publish`
- Action: click `Publicar corrida`
- API: `POST /api/admin/publications/:ingestionRunId/publish`
- Result:
  - version folder created in `storage/published/<datasetVersionId>/`
  - `storage/active/active-dataset.json` updated
  - audit event appended

### Step 6: Verify Active Version

- URLs:
  - `http://localhost:3000/version`
  - `http://localhost:4000/api/public/version`
- Result: both show the same active `datasetVersionId`
- the UI should show localized date/time for publication timestamps

### Step 7: Verify Public Dashboard Change

- URLs:
  - `http://localhost:3000/`
  - `http://localhost:3000/rankings`
  - `http://localhost:3000/institutions/davivienda`
- Result: public UI reflects data from the newly active published dataset

### Step 7A: Verify partial-domain behavior honestly

- if you publish `premiums + incomeStatement` without `financialPosition`:
  - `/version` must show `financialPosition` as unavailable
  - `/rankings` must not pretend that assets/equity are valid
  - `/institutions/:id` must not show assets/patrimony as zero
  - `/` may show income statement summaries if the domain is present

## Partial Dataset Modes

### Premiums Only

- premiums views available
- financial views rendered as unavailable
- charts needing claims remain unavailable

### Financial Position Only

- financial views available
- premiums views rendered as unavailable
- charts needing premiums remain unavailable

### Combined

- both operational domains available
- claims and income statement still unavailable in phase 1

## Rollback

### From the UI

- URL: `http://localhost:3001/publications`
- Action: click `Revertir a esta versión`
- API: `POST /api/admin/publications/:datasetVersionId/rollback`

### What Happens

- `storage/active/active-dataset.json` points back to the selected version
- public routes start serving the previous published dataset
- audit event is recorded

## Troubleshooting

### API root returns `Route GET:/ not found`

This is normal. The API is mounted under `/api/*` and `/health/*`.

### Port 3001 shows `Cannot GET /`

That means the real admin app is not the process currently listening on `3001`.

To free the port on Windows:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

Then start the admin app again:

```bash
corepack pnpm --filter @cnbs/admin dev
```

### Public or admin page serves stale chunks

Clean `.next` and restart:

```bash
corepack pnpm --filter @cnbs/web build
corepack pnpm --filter @cnbs/admin build
```

### Activate OIDC mode

Set the following variables before starting the admin:

```bash
CNBS_AUTH_MODE=oidc
CNBS_OIDC_ISSUER_URL=https://your-issuer/.well-known/openid-configuration
CNBS_OIDC_CLIENT_ID=your-client-id
CNBS_OIDC_CLIENT_SECRET=your-client-secret
CNBS_OIDC_REDIRECT_URI=http://localhost:3001/auth/oidc/callback
```

### Verify active dataset directly

Read:

- `storage/active/active-dataset.json`

and compare with:

- `http://localhost:4000/api/public/version`

### Manual classification checks

Examples that should now classify by structure rather than filename:

- `Primas (2).xlsx` -> premiums
- `balance_aseguradoras_enero.xlsx` -> financialPosition
- `EstadoResultado.xlsx` -> incomeStatement
