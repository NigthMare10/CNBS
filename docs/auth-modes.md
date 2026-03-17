# Auth Modes

## Supported Modes

The admin app supports two authentication modes:

- `local`
- `oidc`

## Local Mode

Default mode for development.

Environment:

- `CNBS_AUTH_MODE=local`
- `CNBS_ADMIN_USER`
- `CNBS_ADMIN_PASSWORD`
- `CNBS_ADMIN_ROLE`

Behavior:

- login form is shown at `/`
- session is stored in the `cnbs-admin-session` cookie
- suitable for local development and isolated testing

## OIDC Mode

Enabled only when all required variables are present.

Required variables:

- `CNBS_AUTH_MODE=oidc`
- `CNBS_OIDC_ISSUER_URL`
- `CNBS_OIDC_CLIENT_ID`
- `CNBS_OIDC_CLIENT_SECRET`
- `CNBS_OIDC_REDIRECT_URI`

Optional:

- `CNBS_OIDC_SCOPES`
- `CNBS_OIDC_POST_LOGOUT_REDIRECT_URI`

Behavior:

- login screen shows SSO entry action
- admin redirects through `/auth/oidc/login`
- callback handled by `/auth/oidc/callback`
- resulting admin session uses the same internal cookie abstraction as local mode

## Fallback Rule

If OIDC mode is requested but the required variables are incomplete, the system falls back safely to local mode behavior.
