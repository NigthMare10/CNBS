# Mapeo de Dominios

## Workbooks observados

Los workbooks reales revisados para estabilizar la semantica incluyen:

- `Primas (1).xlsx`
- `Primas (2).xlsx`
- `Primas (3).xlsx`
- `EstadoSituacionFinanciera (1).xlsx`
- `EstadoSituacionFinanciera (2).xlsx`
- `EstadoResultado.xlsx`
- `INFORME_FINANCIERO_PRELIMINAR_CAHDA_DICIEMBRE-2025 VF.xlsx`

## Dominio `premiums`

### Hoja y columnas base

- hoja preferida: `Datos`
- columnas: `Fecha Reporte`, `CodInstitucion`, `Institucion`, `RamoPadre`, `Ramo`, `CodMoneda`, `Moneda`, `Saldo`

### Derivaciones operativas

- primas por institucion
- primas por ramo
- participacion de mercado
- rankings de primas

## Dominio `financialPosition`

### Hoja y columnas base

- hoja preferida: `Datos` o equivalente tabular detectado por firma
- columnas: `Tipo`, `Inst`, `Logo`, `FechaReporte`, `Linea`, `Cuenta`, `MonedaNacional`, `MonedaExtranjera`

### Marcadores semanticos principales

- `TOTAL ACTIVOS`
- `PASIVOS`
- `PATRIMONIO`
- `RESERVAS TECNICAS Y MATEMATICAS`
- `CUENTAS DE ORDEN Y REGISTRO`

### Estrategia de matching

- matching por alias directo
- matching tras normalizacion y reparacion de texto
- fallback por `lineNumber` cuando la linea es autoritativa y el texto no es confiable
- bloqueo explicito cuando el alias es ambiguo

## Dominio `incomeStatement`

### Estado actual

- se detecta por estructura y marcadores semanticos
- se traza en source files y validacion
- no se publica como dominio operativo en esta primera version
- nunca debe sustituir a `financialPosition`

## Instituciones, ramos y cuentas

El sistema mantiene catalogos canonicos y alias controlados para:

- instituciones
- ramos y subramos
- cuentas financieras

La normalizacion actual ya cubre:

- mojibake frecuente
- variantes sin tildes
- slash y espacios dobles
- mayusculas/minusculas irregulares
- aliases ambiguos tratados como bloqueo, no como auto-correccion silenciosa
