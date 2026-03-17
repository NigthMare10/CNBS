# Domain Mapping

## Real Workbook Validation

The following real workbooks were inspected to stabilize the semantic model:

- `Primas (1).xlsx`
- `Primas (2).xlsx`
- `EstadoSituacionFinanciera (1).xlsx`
- `EstadoResultado.xlsx`
- `INFORME_FINANCIERO_PRELIMINAR_CAHDA_DICIEMBRE-2025 VF.xlsx`

Observed confirmation:

- both premiums workbooks expose the same tabular schema in sheet `Datos`
- financial position and income statement share a similar tabular shape
- they are differentiated by semantic accounts, not by filename
- `EstadoResultado.xlsx` contains markers such as `INGRESOS`, `EGRESOS`, `Ingresos Financieros`, `Resultado Neto del Ejercicio`
- `EstadoSituacionFinanciera (1).xlsx` contains markers such as `TOTAL ACTIVOS`, `PASIVOS`, `PATRIMONIO`, `Reservas Técnicas y Matemáticas`

## Premiums Domain

### Main Sheet

- preferred sheet: `Datos`

### Base Columns

- `Fecha Reporte`
- `CodInstitucion`
- `Institucion`
- `RamoPadre`
- `Ramo`
- `CodMoneda`
- `Moneda`
- `Saldo`

### Supported Derivations

- premiums by institution
- premiums by ramo
- premiums by ramo parent
- market share
- premium rankings

## Financial Position Domain

### Main Sheet

- preferred sheet: `Datos`

### Base Columns

- `Tipo`
- `Inst`
- `Logo`
- `FechaReporte`
- `Linea`
- `Cuenta`
- `MonedaNacional`
- `MonedaExtranjera`

### Semantic Markers

- `TOTAL ACTIVOS`
- `ACTIVOS`
- `PASIVOS`
- `PATRIMONIO`
- `RESERVAS TÉCNICAS Y MATEMÁTICAS`
- `CUENTAS DE ORDEN Y REGISTRO`

### Fixed Mapping Strategy

- line number + canonical account name + alias support
- mapped only to `financialPosition`
- never reused for `incomeStatement`

### Supported Derivations

- total assets
- reserves
- equity
- institutional balance highlights
- rankings by assets and equity

## Income Statement Domain

### Main Sheet

- preferred sheets may include:
  - `Datos`
  - `Estado de Resultados`
  - `EstadoResultado`
  - `ER`

### Base Columns

- `Tipo`
- `Inst`
- `Logo`
- `FechaReporte`
- `Linea`
- `Cuenta`
- `MonedaNacional`
- `MonedaExtranjera`

### Semantic Markers

- `INGRESOS`
- `EGRESOS`
- `PRIMAS RETENIDAS`
- `INGRESOS FINANCIEROS`
- `GASTOS`
- `RESULTADO NETO DEL EJERCICIO`
- `UTILIDAD`

### Fixed Mapping Strategy

- semantic categories:
  - `netIncome`
  - `retainedPremiums`
  - `financialIncome`
  - `expenses`
  - `other`
- mapped only to `incomeStatement`
- never substituted for `financialPosition`

### Supported Derivations

- semantic detection
- validation by result-domain markers
- traceability in source file classification

### Operational Policy Note

- this domain is detectable
- it is not currently an operational public publication source
- it must never be silently remapped as financial position

## Institution Alias Hardening

Institution normalization now resolves cosmetic variants such as:

- `SEGUROS EQUIDAD, S.A.`
- `SEGUROS EQUIDAD`
- `SEGUROS EQUIDAD SA`

Normalization removes cosmetic tokens like `S.A.` and punctuation before canonical matching.
