# Data Contracts

## Workbook Signatures

## Premium Workbook Signature

Required sheet:

- `Datos`

Required columns, order-insensitive:

- `Fecha Reporte`
- `CodInstitucion`
- `Institucion`
- `RamoPadre`
- `Ramo`
- `CodMoneda`
- `Moneda`
- `Saldo`

Contract notes:

- at least one data row required
- only one reporting period expected in phase 1
- `Saldo` numeric
- workbook role classified as `premiums`

## Financial Position Workbook Signature

Required sheet:

- `Datos`

Required columns, order-insensitive:

- `Tipo`
- `Inst`
- `Logo`
- `FechaReporte`
- `Linea`
- `Cuenta`
- `MonedaNacional`
- `MonedaExtranjera`

Contract notes:

- workbook role classified as `financialPosition`
- `Linea` numeric-like
- at least one row with `TOTAL ACTIVOS`

## Reference Workbook Signature

Required sheets include at minimum:

- `1. Ramos Totales`
- `8. Primas y Siniestros Totales`
- `Ranking del Sistema`
- `descarga app P&S`
- `Balance Diciembre 2025` or equivalent `Balance` sheet
- `descarga BG`

Classification rules:

- multiple sheets
- formulas present
- contains reconciliation-oriented and presentation-oriented tabs

## Canonical Entity Contracts

### Institution

- stable canonical identifier
- canonical name
- source aliases

### Period

- exactly one normalized report date per source workbook in phase 1
- periods across raw and reference workbooks may differ and must be tracked independently

### Insurance Line

- hierarchical mapping with parent-child relationship
- source aliases and typo recovery supported

### Financial Account

- canonical name
- statement type `financialPosition`
- raw line number when available

## Published Dataset Contract

Required metadata:

- `datasetVersionId`
- `status`
- `publishedAt`
- `uploadedBy`
- `businessPeriods`
- `fingerprint`
- `inputs`
- `validationSummary`
- `reconciliationSummary`

Required public artifacts in phase 1:

- institutions catalog
- insurance lines catalog
- financial accounts catalog
- premium facts
- financial position facts
- executive KPI aggregates
- ranking aggregates limited to supported official domains

## Validation Severity Contract

- `critical`: abort publication
- `high`: publication usually blocked by policy in phase 1 unless explicitly whitelisted
- `medium`: publish allowed with warning
- `low`: informational

## Reconciliation Result Contract

- `ruleId`
- `severity`
- `scope`
- `expectedValue`
- `actualValue`
- `differenceAbsolute`
- `differenceRelative`
- `toleranceAbsolute`
- `toleranceRelative`
- `status`
- `message`

## API Contract Principles

- public APIs are read-only
- all responses include active dataset metadata
- paginated list endpoints must accept `page`, `pageSize`, `sort`, and structured filters
- admin write endpoints return safe user messages and internal reference ids
