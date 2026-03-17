# Canonical Data Model

## Modeling Goals

- Decouple public datasets from original Excel layouts.
- Preserve provenance back to source file and ingestion run.
- Support versioned publication, rollback, and audit.
- Support precomputed public views.

## Core Concepts

### Dataset Version

Represents one immutable published dataset.

Key fields:

- `datasetVersionId`
- `createdAt`
- `publishedAt`
- `status`
- `businessPeriods`
- `uploadedBy`
- `inputFingerprint`
- `validationSummary`
- `reconciliationSummary`

### Source File

Represents each uploaded workbook and its metadata.

- `sourceFileId`
- `datasetVersionId`
- `kind` (`premiums`, `financialPosition`, `reference`)
- `originalFilename`
- `sha256`
- `sizeBytes`
- `mimeType`
- `detectedSignature`

## Dimensions

### `institution`

- `institutionId`
- `canonicalCode`
- `canonicalName`
- `shortName`
- `displayName`
- `sector`
- `status`

### `institution_alias`

- `alias`
- `institutionId`
- `source`
- `confidence`

### `period`

- `periodId`
- `reportDate`
- `year`
- `month`
- `yearMonth`
- `excelSerial`

### `currency`

- `currencyId`
- `code`
- `name`
- `kind`

### `insurance_line`

- `lineId`
- `parentLineId`
- `canonicalName`
- `displayName`
- `lineType`
- `sortOrder`

### `insurance_line_alias`

- `alias`
- `lineId`
- `source`

### `financial_account`

- `accountId`
- `lineNumber`
- `canonicalName`
- `statementType`
- `groupName`
- `sortOrder`

### `financial_account_alias`

- `alias`
- `accountId`
- `source`

### `metric_definition`

- `metricId`
- `name`
- `domain`
- `unit`
- `criticality`
- `publicationPolicy`

## Facts

### `fact_premium_amount`

Granularity:

- dataset version
- period
- institution
- ramo parent
- ramo
- currency

Fields:

- `amount`
- `sourceFileId`
- `sourceRowNumber`
- `normalizationNotes`

### `fact_financial_position_amount`

Granularity:

- dataset version
- period
- institution
- financial account

Fields:

- `amountNational`
- `amountForeign`
- `amountCombined`
- `sourceFileId`
- `sourceRowNumber`

### `fact_claim_amount`

Reserved for future authoritative claim feed.

### `fact_income_statement_amount`

Reserved for future authoritative income statement feed.

### `fact_indicator`

Derived metrics only.

- `metricId`
- `scopeType`
- `scopeKey`
- `periodId`
- `value`
- `formulaKey`
- `published`

## Derived Aggregates

### Premium Aggregates

- by institution
- by ramo parent
- by ramo
- market share
- year-over-year change when comparable periods exist

### Financial Aggregates

- totals by institution
- consolidated totals
- account rollups
- balance composition

### Ranking Views

- premiums ranking
- assets ranking
- reserves ranking
- equity ranking
- retained premiums ranking when authoritative derivation exists

## Public Dataset Artifacts

- `manifest.json`
- `metadata.json`
- `catalogs/institutions.json`
- `catalogs/insurance-lines.json`
- `catalogs/financial-accounts.json`
- `facts/premiums.json`
- `facts/financial-position.json`
- `aggregates/executive-kpis.json`
- `aggregates/premiums-by-institution.json`
- `aggregates/premiums-by-line.json`
- `aggregates/financial-highlights.json`
- `aggregates/rankings.json`
- `reports/validation-report.json`
- `reports/reconciliation-report.json`

## Publication Policy

- Premium facts are publishable in phase 1.
- Financial position facts are publishable in phase 1.
- Claim facts are not publishable until raw authoritative source exists.
- Income statement facts are not publishable until raw authoritative source exists.
- Reference-only values may appear in validation reports but not as official public facts.
