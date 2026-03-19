# Modos de Autenticacion

## Modos soportados

- `local`
- `oidc`

## `local`

Uso previsto:

- desarrollo local
- pruebas operativas controladas

Comportamiento:

- login por usuario y password configurados
- la sesion se guarda en cookie firmada
- las llamadas del admin al API usan token firmado de servicio mas secreto administrativo

## `oidc`

Uso previsto:

- revision institucional o despliegue con SSO corporativo

Requiere:

- `CNBS_AUTH_MODE=oidc`
- issuer URL
- client id
- client secret
- redirect URI

Comportamiento:

- el login se hace via `/auth/oidc/login`
- el callback valida `state`, `nonce` y PKCE
- al completar, se crea la misma cookie firmada de sesion interna

## Limitacion actual

En esta primera version, OIDC autentica identidad pero no implementa aun mapeo fino de grupos o claims a roles institucionales. El rol operativo sigue definido por configuracion del entorno.
