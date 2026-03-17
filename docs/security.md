# Security Strategy

## Threat Model

Primary threats:

- malicious workbook uploads
- macro/VBA execution attempts
- formula injection in exported or rendered values
- XSS via workbook strings
- CSRF on admin actions
- SSRF or path traversal in upload handling
- zip bombs and decompression abuse
- privilege escalation in admin

## Controls

### Upload Security

- only `.xlsx` allowed in phase 1
- extension, MIME, and magic-byte verification
- size limits
- compression ratio checks
- encrypted/protected workbook rejection
- macro-enabled content rejection
- sanitized original filename persistence
- optional reference workbook allowed, but not required
- safe separation between security rejection and functional classification rejection

### Parsing Security

- parse OOXML data only
- never execute VBA or formulas
- use cached formula values only for the reference workbook

### Input Security

- trim, normalize, and sanitize all strings
- HTML escaping by default in UI
- no untrusted HTML rendering
- formula-like cell values prefixed on export when needed

### Authentication and Authorization

- private admin app only
- session-based auth in local dev
- configurable `local` or `oidc` admin auth mode
- RBAC roles: `admin`, `uploader`, `validator`, `publisher`, `auditor`
- least privilege for publish and rollback actions

### HTTP Security

- CSP
- HSTS in secure environments
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`

### Abuse Protection

- rate limiting on upload endpoints
- smaller limits on auth endpoints
- request body size caps
- structured audit logging

## Partial Publication Security Notes

- missing one primary source is handled as controlled warning, not as unsafe implicit default
- runtime never fabricates unsupported claims or income statement values
- reference workbook is treated as optional non-authoritative input and cannot force publication of unsupported business facts

## Classification Safety Notes

- filenames are not trusted for business interpretation
- unknown or low-confidence workbooks are rejected as unclassified, not misclassified
- safe multipart filtering removes empty placeholders and `blob` phantom uploads before ingestion

## Error Handling Policy

- safe user-facing error messages
- technical diagnostics only in internal logs
- correlation id on every request and ingestion run
