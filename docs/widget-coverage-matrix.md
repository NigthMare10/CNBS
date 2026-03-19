# Matriz de Cobertura de Widgets

| Vista | Widget o bloque | Dominio requerido | Formula o criterio | Artefacto publicado | Estado | Razon si no aplica |
|---|---|---|---|---|---|---|
| `/` | KPIs ejecutivos de primas | premiums | sumatorias de primas | `aggregates/executive-kpis.json` | soportado | |
| `/` | KPIs ejecutivos de activos y reservas | financialPosition | sumatorias por cuenta canonica | `aggregates/executive-kpis.json` | soportado | |
| `/` | Primas por ramo | premiums | `sum(amount) group by ramoId` | `aggregates/premiums-by-line.json` | soportado | |
| `/` | Relacion siniestros / primas | claims + historico | no implementable con fuentes actuales | no existe | no soportado | no hay claims operativos |
| `/` | Participacion de mercado por compania | premiums | `premiumAmount / totalPremiums` | `aggregates/premiums-by-institution.json` | soportado | |
| `/` | Primas totales por compania | premiums | sumatoria por institucion | `aggregates/premiums-by-institution.json` | soportado | |
| `/` | Siniestros totales por compania | claims | no existe | no existe | no soportado | no hay claims operativos |
| `/` | Top instituciones por primas | premiums | ranking descendente | `aggregates/premiums-by-institution.json` | soportado | |
| `/` | Top instituciones por activos | financialPosition | ranking descendente | `aggregates/financial-highlights.json` | soportado | |
| `/` | Reservas tecnicas por institucion | financialPosition | ranking descendente | `aggregates/financial-highlights.json` | soportado | |
| `/` | Dona de participacion de mercado | premiums | share por institucion | `aggregates/premiums-by-institution.json` | soportado | |
| `/` | Cobertura por dominio | metadata publicada | `domainAvailability` | `metadata.json` | soportado | |
| `/rankings` | Ranking de primas | premiums | orden por `premiumAmount` | `aggregates/rankings.json` | soportado | |
| `/rankings` | Ranking de activos | financialPosition | orden por `totalAssets` | `aggregates/rankings.json` | soportado | requiere balance |
| `/rankings` | Ranking de patrimonio | financialPosition | orden por `equity` | `aggregates/rankings.json` | soportado | requiere balance |
| `/rankings` | Ranking de reservas | financialPosition | orden por `totalReserves` | `aggregates/rankings.json` | soportado | requiere balance |
| `/version` | Metadata de version activa | metadata publicada | estado actual | `metadata.json` | soportado | |
| `/institutions/[institutionId]` | Resumen de primas | premiums | agregado por institucion | `aggregates/institutions/<institutionId>.json` | soportado | |
| `/institutions/[institutionId]` | Preview top de ramos | premiums | top 20 por monto | `aggregates/institutions/<institutionId>.json` | soportado | |
| `/institutions/[institutionId]` | Resumen financiero | financialPosition | highlights por institucion | `aggregates/institutions/<institutionId>.json` | soportado | requiere balance |
| `/institutions/[institutionId]` | Bloque de resultados | incomeStatement operativo | no permitido por politica actual | no existe | no soportado | incomeStatement no es fuente publica |
