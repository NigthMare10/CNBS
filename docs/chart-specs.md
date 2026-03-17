# Chart Specs

## Source of Specification

The chart specification was extracted from the reference workbook chart objects and related sheet formulas, especially the `Gráficos` sheet and chart XML references.

Machine-readable version:

- `config/chart-specs.json`

## Extracted Reference Charts

### 1. Primas y Siniestros por Ramo a Diciembre

- Reference title: `Primas y Siniestros por Ramo a Diciembre 2025`
- Reference ranges:
  - `'1. Ramos Totales'!$A$10:$A$20`
  - `'1. Ramos Totales'!$C$10:$C$20`
  - `'1. Ramos Totales'!$G$10:$G$20`
- Expected dimension: ramo
- Expected series: primas, siniestros
- Runtime support: partial
- Current runtime behavior: render premiums by ramo only, with explicit note that claims data is unavailable in current sources

### 2. Relación de Siniestros / Primas por Ramo (2025 vs 2024)

- Reference title: `Relación de Siniestros / Primas por Ramo 2025 vs. 2024`
- Reference ranges:
  - `'1. Ramos Totales'!$J$10:$J$20`
  - `'1. Ramos Totales'!$K$10:$K$20`
- Expected dimensions: ramo, period
- Runtime support: unavailable
- Missing data:
  - authoritative claims source
  - historical comparative raw publication for 2024

### 3. Participación de Mercado a Diciembre por Compañía

- Reference title: `Participación de Mercado a Diciembre por Compañía`
- Reference ranges:
  - `'8. Primas y Siniestros Totales'!$B$10:$B$21`
  - `'8. Primas y Siniestros Totales'!$D$10:$D$21`
- Expected dimension: institution
- Runtime support: fully supported
- Runtime derivation: published premium totals by institution + market share percentage

### 4. Primas y Siniestros Totales por Compañía

- Reference title: `Primas y Siniestros Totales por Compañía`
- Reference ranges:
  - `'8. Primas y Siniestros Totales'!$D$10:$D$21`
  - `'8. Primas y Siniestros Totales'!$H$10:$H$21`
- Expected dimension: institution
- Runtime support: partial
- Current runtime behavior: render premiums totals only, with explicit note that claims series is unavailable with current sources

## Additional Supported Runtime Visualizations

### Top Instituciones por Activos

- Domain: financial position
- Question answered: which institutions concentrate the largest assets in the active publication?
- Runtime support: fully supported

### Reservas Técnicas por Institución

- Domain: financial position
- Question answered: which institutions hold the largest reserves in the active publication?
- Runtime support: fully supported

### Participación de Mercado (Dona)

- Domain: premiums
- Question answered: how is market share distributed among the leading institutions?
- Runtime support: fully supported

## Runtime Rule

The dashboard must never invent or extrapolate unsupported series. If the current operational sources do not support a chart honestly, the UI must render a safe unavailable state and explain which source is missing.

## Additional Preliminary Workbook References

The preliminary workbook also exposes result-oriented sheets that now inform semantic support decisions:

- `1. Utilidad` -> aligns with income statement `netIncome`
- `2. Ingresos Financieros` -> aligns with income statement `financialIncome`
- `7.1 Primas Retenidas` -> aligns with income statement `retainedPremiums`

These are now modeled as business references for the `incomeStatement` domain, not as runtime sources.
