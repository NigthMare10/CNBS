# Especificacion de Graficos

## Regla general

Los graficos publicos deben ser honestos respecto a la cobertura real de `premiums` y `financialPosition`.

- si el dato existe y es derivable, se publica
- si falta la fuente o la relacion no es segura, se muestra `Dato no disponible`

## Graficos del home

| Grafico | Dominio requerido | Artefacto | Estado |
|---|---|---|---|
| Primas por ramo a diciembre | premiums | `aggregates/premiums-by-line.json` | soportado |
| Relacion siniestros / primas por ramo | claims + premiums historicos | no existe | omitido honestamente |
| Participacion de mercado por compania | premiums | `aggregates/premiums-by-institution.json` | soportado |
| Primas totales por compania | premiums | `aggregates/premiums-by-institution.json` | soportado |
| Siniestros totales por compania | claims | no existe | omitido honestamente |
| Top instituciones por primas | premiums | `aggregates/premiums-by-institution.json` | soportado |
| Concentracion por ramo | premiums | `aggregates/premiums-by-line.json` | soportado |
| Top instituciones por activos | financialPosition | `aggregates/financial-highlights.json` | soportado |
| Reservas tecnicas por institucion | financialPosition | `aggregates/financial-highlights.json` | soportado |
| Dona de participacion de mercado | premiums | `aggregates/premiums-by-institution.json` | soportado |

## Rankings visibles

| Vista | Dominio requerido | Artefacto | Estado |
|---|---|---|---|
| Ranking de primas | premiums | `aggregates/rankings.json` | soportado |
| Ranking de activos | financialPosition | `aggregates/rankings.json` | soportado si hay balance |
| Ranking de patrimonio | financialPosition | `aggregates/rankings.json` | soportado si hay balance |
| Ranking de reservas tecnicas | financialPosition | `aggregates/rankings.json` | soportado si hay balance |

## Referencia del informe preliminar

El informe preliminar se usa como referencia conceptual de cuadros, no como fuente runtime. En particular:

- `1. Ramos Totales` sirve para contrastar la intencion del grafico de primas por ramo
- `8. Primas y Siniestros Totales` sirve para revisar cuadros por compania
- hojas de utilidad o ingresos financieros solo sirven como referencia semantica, no como fuente publica
