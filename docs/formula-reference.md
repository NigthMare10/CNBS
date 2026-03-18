# Formula Reference

## Role of the Preliminary Workbook

`INFORME_FINANCIERO_PRELIMINAR_CAHDA_DICIEMBRE-2025 VF.xlsx` is treated as a business oracle for formulas, charts, and presentation logic.

It is not an operational runtime source.

## Confirmed Source Relationships

### Derived from Premiums

- premiums by ramo
- premiums by institution
- market share
- premium rankings

### Derived from Financial Position

- total assets
- equity
- reserves
- balance-based institutional highlights

### Derived from Combined Domains

- institutional profile with premiums + balance

## Detected but Non-Operational Domain

`incomeStatement` can still be classified for validation and traceability, but it is not part of the current operational publication policy.

Therefore, formulas that depend on explicit result-domain raw inputs are documented but not published as official public runtime metrics.

## Implemented Public Formulas from the Two Operational Sources

### From Premiums

- `total-premiums = sum(Saldo)`
- `premiums-by-institution = sum(Saldo) group by institution`
- `premiums-by-line = sum(Saldo) group by ramo`
- `market-share = premiums-by-institution / total-premiums`

### From Financial Position

- `total-assets = sum(amountCombined where accountId = total-activos)`
- `equity = sum(amountCombined where accountId = patrimonio)`
- `technical-reserves = sum(amountCombined where accountId = reservas-tecnicas)`

### Public Visualizations Backed by Those Formulas

- market share donut by institution
- top premiums by institution
- premiums by ramo
- top assets by institution
- technical reserves by institution
- rankings for premiums, assets, equity, and reserves

## Useful Runtime Visualizations Added

- market share donut by institution from premiums
- top net income by institution from income statement
- domain coverage panel for the active dataset
- institution blocks separated into premiums, balance, and results

## Preliminary Workbook Relationships Observed

### Chart/Sheet Families

- `1. Ramos Totales` -> premiums and claims by ramo
- `8. Primas y Siniestros Totales` -> company participation and totals
- `1. Utilidad` -> result-oriented comparison reference only
- `2. Ingresos Financieros` -> result-domain reference only
- `5. Activos Totales` -> balance relationship
- `6. Patrimonio` -> balance relationship
- `7.1 Primas Retenidas` -> income statement relationship

## Supported Today

- premiums-based charts from premiums source
- market-share chart from premiums source
- balance highlights from financial position source
- reserves-based highlights and rankings from financial position source

## Not Yet Fully Reproducible with Integrity

- claims series and claim ratios without authoritative claims feed
- income statement runtime publication under the current two-source policy
- interannual 2025 vs 2024 metrics without historical raw publication in the same operational model
- formulas that need explicit cross-domain claims data
