# Pilot Readiness

## Objetivo de esta primera version

Presentar a CNBS una primera version operativa y honesta del dashboard institucional del sector asegurador, basada en:

- ingesta manual segura
- staging con validacion y reconciliacion
- publicacion versionada
- active version y rollback
- frontend publico que no inventa datos

## Lo que ya esta listo para piloto

- upload -> staging -> validate -> reconcile -> publish -> active version -> rollback
- deteccion por firma estructural
- seguridad basica de workbooks y multipart
- admin operativo con trazabilidad
- frontend publico con vistas institucionales basadas en artefactos publicados
- alias hardening y reparacion de texto
- cache y payloads optimizados para uso local

## Lo que no forma parte del piloto

- claims o siniestros operativos
- comparativos historicos inventados
- publicacion oficial de `incomeStatement`
- uso del informe preliminar como fuente runtime

## Limitaciones reales del piloto

- OIDC aun no resuelve roles por claims o grupos
- CORS y algunas politicas de despliegue siguen ajustadas a entorno local
- el parser del informe preliminar sigue siendo sensible a layout especifico
- `/reconciliation` sigue siendo la vista mas pesada por su nivel de detalle tecnico

## Recomendacion de uso institucional

- usar el piloto para validar operacion, narrativa, coverage y flujo versionado
- no usarlo aun como entorno productivo internet-facing sin cierre adicional de seguridad y despliegue
