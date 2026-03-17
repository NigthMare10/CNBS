# Observability

## Signals

- logs
- metrics
- traces
- dataset lineage metadata

## Logging

- structured JSON logs
- request id, ingestion run id, dataset version id
- no secret leakage
- separate event types for upload, validation, reconciliation, publish, rollback, and API access

## Metrics

### Technical

- request count and latency
- ingestion duration by stage
- failed ingestion count
- active dataset age
- publish count
- rollback count

### Business

- published business period
- number of institutions in active dataset
- total premium amount in active dataset
- total assets in active dataset
- reconciliation discrepancy counts by severity

## Health Endpoints

- `/health/live`
- `/health/ready`
- `/api/public/version`
- `/api/admin/system/status`

## Traceability

- every upload receives an `ingestionRunId`
- every published dataset links back to source file ids and run id
