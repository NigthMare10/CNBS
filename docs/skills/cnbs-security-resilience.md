# CNBS Security Resilience

## Objetivo

Aplicar controles de seguridad y resiliencia end-to-end al flujo de carga y publicación.

## Cuándo usarla

- al implementar upload, publish, rollback y protección HTTP

## Entradas esperadas

- endpoints
- pipeline de ingesta
- almacenamiento

## Reglas

- última versión válida siempre disponible
- entrada binaria no confiable por defecto

## Validaciones

- límites
- rate limiting
- headers
- rollback operativo

## Errores comunes

- mezclar plano público y plano privado

## Criterios de salida

- sistema seguro y tolerante a fallos
