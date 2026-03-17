# Ingestion Pipeline

## Pipeline Stages

```text
upload -> quarantine -> classify -> parse -> validate -> normalize -> reconcile -> build -> publish
```

## Stage Details

### 1. Upload

- private endpoint only
- accept only expected workbook count and types
- store original file metadata and binary in quarantine
- calculate SHA-256

### 2. Quarantine Checks

- extension, MIME, and magic bytes check
- zip entry count threshold
- compressed/uncompressed ratio threshold
- encrypted workbook rejection
- macro-enabled workbook rejection
- protected/unexpected workbook rejection

### 3. Classification

- inspect workbook sheets and columns
- assign role by signature
- reject ambiguous or duplicate roles

### 4. Parse

- read worksheets without evaluating formulas as code
- collect cached formula values from reference workbook when needed
- extract row-level provenance

### 5. Validate

- required sheets present
- required columns present
- numeric fields parse
- periods parse
- duplicate natural keys detection
- unsupported currencies or missing institutions flagged

### 6. Normalize

- trim strings
- Unicode cleanup
- typo repair for known aliases
- canonical institution mapping
- canonical ramo mapping
- canonical account mapping

### 7. Reconcile

- execute rules from `docs/reconciliation-rules.md`
- compare raw-derived aggregates with reference workbook only where period comparison is meaningful
- mark mismatched periods explicitly

### 8. Build

- generate canonical facts
- generate published catalogs
- precompute aggregates and rankings
- generate validation and reconciliation reports

### 9. Publish

- write immutable version directory
- generate manifest and metadata
- atomically replace active pointer
- emit audit event

## Job States

- `uploaded`
- `quarantined`
- `classified`
- `parsed`
- `validated`
- `normalized`
- `reconciled`
- `built`
- `published`
- `failed`
- `rolledBack`

## Retry Policy

- transient file-system errors: retry up to 3 times
- contract or data-quality failures: no retry, fail fast
- publication pointer update: retry up to 3 times

## Dead Letter Strategy

- failed ingestion reports remain in `storage/audit/failed-runs/`
- original uploads remain linked to the failed run id

## Timeout Policy

- upload validation: 30s
- workbook parsing: 120s
- full ingestion build: 300s in local mode

## Rollback Pipeline

1. select a prior published version
2. verify version integrity
3. replace active pointer
4. record audit event
5. trigger cache revalidation
