# Referencia de Formulas

## Alcance

Las formulas publicas oficiales de esta primera version salen exclusivamente de los artefactos publicados derivados de:

- `premiums`
- `financialPosition`

El informe preliminar solo actua como oraculo para revisar relaciones y cuadros esperados.

## Formulas implementadas

| Metrica | Dominio requerido | Formula | Artefacto publicado |
|---|---|---|---|
| Primas totales | premiums | `sum(amount)` | `aggregates/executive-kpis.json` |
| Primas por institucion | premiums | `sum(amount) group by institutionId` | `aggregates/premiums-by-institution.json` |
| Primas por ramo | premiums | `sum(amount) group by ramoId` | `aggregates/premiums-by-line.json` |
| Participacion de mercado | premiums | `premiumAmount / totalPremiums` | `aggregates/premiums-by-institution.json` |
| Activos totales del sistema | financialPosition | `sum(amountCombined where accountId = total-activos)` | `aggregates/executive-kpis.json` |
| Reservas tecnicas del sistema | financialPosition | `sum(amountCombined where accountId = reservas-tecnicas)` | `aggregates/executive-kpis.json` |
| Activos por institucion | financialPosition | `sum(amountCombined where accountId = total-activos) group by institutionId` | `aggregates/financial-highlights.json` |
| Patrimonio por institucion | financialPosition | `sum(amountCombined where accountId = patrimonio) group by institutionId` | `aggregates/financial-highlights.json` |
| Reservas tecnicas por institucion | financialPosition | `sum(amountCombined where accountId = reservas-tecnicas) group by institutionId` | `aggregates/financial-highlights.json` |

## Rankings soportados

| Ranking | Dominio requerido | Artefacto |
|---|---|---|
| Primas | premiums | `aggregates/rankings.json` |
| Activos | financialPosition | `aggregates/rankings.json` |
| Patrimonio | financialPosition | `aggregates/rankings.json` |
| Reservas tecnicas | financialPosition | `aggregates/rankings.json` |

## Bloques institucionales soportados

| Bloque | Dominio requerido | Artefacto |
|---|---|---|
| Resumen de primas | premiums | `aggregates/institutions/<institutionId>.json` |
| Preview top de ramos | premiums | `aggregates/institutions/<institutionId>.json` |
| Resumen financiero | financialPosition | `aggregates/institutions/<institutionId>.json` |
| Conteo de filas financieras | financialPosition | `aggregates/institutions/<institutionId>.json` |

## No soportado con integridad en esta version

| Serie o formula | Motivo de omision |
|---|---|
| Siniestros / claims | no existe feed raw autoritativo en el runtime actual |
| Relacion siniestros / primas | depende de claims no operativos |
| Comparativos historicos homogeneos | no hay publicacion raw equivalente para todos los dominios visibles |
| KPIs de income statement | `incomeStatement` no es fuente operativa publica |

## Regla de implementacion

- ninguna formula visible debe leer Excel en request-time
- toda cifra publica debe salir de artefactos publicados y versionados
- cuando una formula no es soportada, la UI debe explicarlo y no simular el dato
