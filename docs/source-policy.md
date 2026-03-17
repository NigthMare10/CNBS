# Source Policy

## Operational Sources

The CNBS Dashboard now operates with two primary workbooks only:

1. `Primas.xlsx`
2. `EstadoSituacionFinanciera.xlsx`

The workbook previously used as functional reference (`INFORME_FINANCIERO_PRELIMINAR...xlsx`) is now optional.

## Upload Policy

Accepted operational combinations:

- premiums only
- financial position only
- premiums + financial position
- premiums + financial position + optional reference
- premiums + optional reference
- financial position + optional reference

Blocked combination:

- reference only
- no primary source at all

## Publication Behavior

### Premiums Only

- publish premiums domain
- publish rankings and market share based on premiums
- mark financial domain as unavailable
- claims and income statement remain unavailable

### Financial Position Only

- publish financial position domain
- publish institutional financial highlights
- mark premiums domain as unavailable
- claims and income statement remain unavailable

### Combined

- publish premiums + financial position domains
- publish full phase-1 scope supported by current sources

### Optional Reference Provided

- use it only for reconciliation and chart specification alignment
- do not require it for upload, publish, active version, or public runtime

## Non-Supported Domains in Phase 1

- official claims facts
- official income statement facts
- claims-to-premium ratios based on authoritative claims source
- interannual 2025 vs 2024 comparisons when no raw historical publication exists
