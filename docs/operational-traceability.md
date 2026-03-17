# Operational Traceability

## Time Handling

- timestamps are stored internally in UTC ISO strings
- UI surfaces render timestamps using the configured display timezone
- current default timezone: `America/Tegucigalpa`

Impacted fields:

- `createdAt`
- `publishedAt`
- audit `timestamp`
- active dataset pointer `updatedAt`

## Run to Dataset Traceability

Every dataset version now carries:

- `datasetVersionId`
- `ingestionRunId`
- `uploadedBy`
- `publishedAt`
- `datasetScope`
- `domainAvailability`

Every staged run now carries:

- `ingestionRunId`
- `publicationState`
- `publishedDatasetVersionId`
- `publishedAt`

This allows the admin UI to answer:

- which run produced which dataset version
- whether a run has already been published
- whether that publication is the active dataset
- when a publication happened in local display time

## Admin Views

### Ingestions

- shows publication state
- shows dataset version when already published
- highlights when the run produced the active version

### Publish

- disables effective publish action by replacing it with informational state when the run was already published
- shows when and as which dataset it was published

### Publications / History

- show dataset version id, ingestion run id, publication time, status and operational label

### Audit

- shows action, actor, ingestion run id, dataset version id and formatted timestamp
- highlights events linked to the active version
