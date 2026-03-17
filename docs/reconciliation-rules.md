# Reconciliation Rules

## Policy

- Reference workbook is used for reconciliation, not as operational truth.
- If raw and reference periods differ, exact business reconciliation is downgraded to warning unless a rule is explicitly period-agnostic.
- Critical discrepancies block publication.

## Rule Groups

### Premium Totals

- compare total premiums by institution
- compare total premiums by ramo parent where mappings exist
- compare grand total premiums

### Financial Position Totals

- compare `TOTAL ACTIVOS` by institution
- compare `Reservas Técnicas y Matemáticas` by institution
- compare `PATRIMONIO` by institution
- compare consolidated totals where available

### Rankings

- compare top-N order for supported official metrics
- ranking mismatches are `high` unless caused by period mismatch

### Indicators

- only indicators supported by authoritative phase 1 sources are official
- reference-only ER and claims indicators are non-public validation signals

## Severity Matrix

- `critical`: missing primary sheet, duplicated natural key, active pointer corruption, premium grand total mismatch beyond tolerance for matching periods, balance total mismatch beyond tolerance for matching periods
- `high`: major institution-level mismatch, ranking mismatch, unsupported alias mapping requiring manual review
- `medium`: period mismatch, missing non-critical reference tab, unrecognized optional row
- `low`: display-only label drift, whitespace differences

## Tolerances

- default absolute tolerance: `0.01`
- default relative tolerance: `0.001`
- configurable per rule
