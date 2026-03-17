# CNBS Observability Release

## Objetivo

Instrumentar corridas de ingesta, publicación y rollback con trazabilidad completa.

## Cuándo usarla

- al implementar logs, métricas y estado del sistema

## Entradas esperadas

- eventos de API
- etapas de ETL

## Reglas

- toda corrida debe tener correlación única

## Validaciones

- logs estructurados
- métricas de publicación
- health checks

## Errores comunes

- logs sin contexto de versión o corrida

## Criterios de salida

- operación observable y auditable
