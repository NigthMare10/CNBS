# Estrategia de Seguridad

## Amenazas principales

- uploads maliciosos o corruptos
- macro / encrypted workbook
- zip bombs
- placeholders `blob` o multipart fantasma
- path traversal en nombres de archivo
- escalamiento de privilegios en admin
- CSRF en mutaciones administrativas
- exposicion innecesaria de metadata operativa

## Controles implementados

### Upload y workbook hardening

- solo `.xlsx`
- validacion de extension, MIME y magic bytes
- limite de tamano
- deteccion de macro y encrypted package
- chequeo de workbook protegido
- filtro de uploads `blob` y zero-byte
- nombres originales sanitizados antes de persistir

### Admin auth y autorizacion

- cookie administrativa firmada y con expiracion
- token firmado server-to-server para llamadas admin hacia el API
- el API ya no confia en `user` o `role` enviados en claro
- RBAC operativo por rol: `admin`, `uploader`, `validator`, `publisher`, `auditor`

### Mutaciones y protecciones HTTP

- verificacion de origen confiable en server actions administrativas
- `helmet` en API
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` en `web` y `admin`
- rate limiting reforzado en uploads, publish y rollback

## Limitaciones conocidas para piloto

- el cookie signing usa el secreto administrativo del entorno; para produccion real conviene separar secreto de sesion y secreto de integracion
- no hay politica completa de allowlist de claims/grupos para OIDC; hoy el rol operativo sigue viniendo de configuracion
- CORS del API sigue abierto para facilitar integracion local; para produccion debe cerrarse por origen
- el analisis anti zip bomb sigue ocurriendo despues de copiar el archivo a cuarentena; para produccion real conviene aislar parseo y limpieza temprana

## Regla operativa de seguridad de datos

- el informe preliminar no puede forzar publicacion publica
- `incomeStatement` no puede contaminar la politica operativa de dos fuentes primarias
- si falta un artefacto opcional, el sistema debe degradar seguro; si falta un artefacto critico, debe bloquear o responder con estado controlado
