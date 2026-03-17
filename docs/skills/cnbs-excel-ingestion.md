# CNBS Excel Ingestion

## Objetivo

Guiar la detección segura, parsing, validación y publicación de workbooks CNBS.

## Cuándo usarla

- al implementar carga manual
- al revisar fallas de parsing

## Entradas esperadas

- tres workbooks `.xlsx`
- firmas de columnas y hojas

## Reglas

- detectar por esquema
- no ejecutar fórmulas ni macros
- abortar publicación en fallas críticas

## Validaciones

- estructura
- período
- duplicados
- seguridad del archivo

## Errores comunes

- confiar en el nombre del archivo
- asumir orden fijo de columnas

## Criterios de salida

- dataset de staging válido o falla documentada
