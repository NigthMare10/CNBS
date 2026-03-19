# Politica de Fuentes

## Regla operativa vigente

La primera version operativa del dashboard CNBS usa solo dos fuentes primarias para publicacion publica:

1. `premiums`
2. `financialPosition`

El informe preliminar no es fuente runtime. Solo se usa como:

- oraculo de formulas
- oraculo de cuadros
- referencia semantica de nombres y relaciones

`incomeStatement` puede detectarse y trazarse, pero no cambia la politica operativa publica actual.

## Clasificacion

- los archivos se clasifican por estructura, headers y senales semanticas
- el nombre del archivo no define el dominio de negocio
- si la clasificacion no es segura, la corrida se bloquea

## Combinaciones aceptadas

- `premiums` solo
- `financialPosition` solo
- `premiums + financialPosition`
- cualquiera de las anteriores con `reference` opcional
- cualquiera de las anteriores con `incomeStatement` detectable y no operativo

## Combinaciones bloqueadas

- `reference` solo
- `incomeStatement` solo
- ningun workbook primario
- workbook no clasificado con confianza insuficiente

## Comportamiento de publicacion

### `premiums-only`

- publica metricas y artefactos de primas
- deja el dominio financiero como no disponible
- no inventa claims ni resultados

### `financial-only`

- publica highlights y rankings financieros soportados
- deja el dominio de primas como no disponible
- no inventa claims ni resultados

### `premiums-financial`

- publica ambos dominios operativos
- habilita KPIs y vistas institucionales derivables con integridad

## Regla sobre `datasetScope`

En la implementacion actual, `datasetScope` publicado se mantiene en estos estados operativos:

- `premiums-only`
- `financial-only`
- `premiums-financial`
- `empty`

Si aparece `incomeStatement` junto a un dominio operativo, se conserva para trazabilidad, pero no altera el `datasetScope` publico.

## Dominios y series no soportados en fase piloto

- claims oficiales
- relaciones siniestros / primas con fuente autoritativa
- series historicas homogeneas 2025 vs 2024 si no existen raw publications equivalentes
- publicacion operativa del `incomeStatement`

## Regla de honestidad

Cuando una vista, ranking o grafico no puede derivarse con integridad desde `premiums` o `financialPosition`, el sistema debe:

- responder con estado seguro
- mostrar `Dato no disponible`
- explicar que fuente o dominio falta
- no extrapolar ni completar con supuestos
