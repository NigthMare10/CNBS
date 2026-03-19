# Estrategia de Testing

## Objetivo

La suite debe proteger la primera version operativa basada en dos fuentes primarias:

- `premiums`
- `financialPosition`

## Capas de prueba

### Unitarias

- deteccion de firmas de workbook
- normalizacion y reparacion de texto
- alias y guardrails de ambiguedad
- tokens firmados y validacion de integridad
- formulas de agregacion y rankings

### Integracion

- upload -> parse -> validate -> normalize -> publish
- datasets parciales honestos
- `premiums + financialPosition`
- active version
- rollback
- degradacion segura cuando falta la version activa o un artefacto opcional
- respuestas admin/public sin 500 evitables

### Regresion

- filenames arbitrarios
- mojibake frecuente
- variantes sin tildes
- slash y espacios dobles
- mayusculas/minusculas irregulares
- alias ambiguos bloqueados
- `incomeStatement` detectable pero no operativo
- oraculo preliminar no convertido en fuente runtime

## Casos minimos obligatorios

- upload multiple valido
- upload corrupto o vacio
- workbook no clasificado
- referencia sola bloqueada
- publish de corrida bloqueada responde de forma controlada
- `system/status` funciona con y sin version activa valida
- home, rankings, version e institucion responden con estados honestos

## Regla de calidad

- toda correccion de estabilidad o seguridad debe venir con test si el punto es deterministico
- las limitaciones deliberadas tambien deben quedar probadas para evitar regresiones engañosas
