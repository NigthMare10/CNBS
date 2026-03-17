# Source Policy

## Operational Sources

The CNBS Dashboard classifies uploads by workbook structure and semantic content, not by filename.

Primary operational workbook types:

1. premiums
2. financial position

Additional detectable but non-operational type:

- income statement

The reference workbook (`INFORME_FINANCIERO_PRELIMINAR...xlsx`) remains optional and non-authoritative.

## Upload Policy

Accepted operational combinations:

- premiums only
- financial position only
- premiums + financial position
- premiums + financial position + optional reference
- premiums + optional reference
- financial position + optional reference
- premiums + financial position + detected income statement
- premiums + detected income statement
- financial position + detected income statement
- any of the above + optional reference
- premiums + optional reference
- financial position + optional reference

Blocked combination:

- reference only
- no primary source at all
- unclassified workbook with insufficient structural confidence

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

- publish the domains that were actually supplied and classified with confidence
- dataset scope reflects the exact combination detected

### Detected Income Statement Workbook

- may be classified and traced in source files
- is not treated as operational source for public publication
- cannot by itself produce a publishable runtime dataset
- if uploaded together with premiums or financial position, the public dataset still reflects only the two operational sources

### Optional Reference Provided

- use it only for reconciliation and chart specification alignment
- do not require it for upload, publish, active version, or public runtime

## Non-Supported Domains in Phase 1

- official claims facts
- operational income statement publication
- claims-to-premium ratios based on authoritative claims source
- interannual 2025 vs 2024 comparisons when no raw historical publication exists

## Classification Policy

- filenames are ignored for business classification
- workbooks are scored using:
  - sheet names
  - canonicalized headers
  - semantic account markers
  - workbook structure
- if confidence is insufficient, the file is marked unclassified and the run is blocked with an actionable message
