# Testing Strategy

## Layers

- unit tests
- integration tests
- end-to-end tests
- regression tests with workbook fixtures

## Fixture Policy

- preserve the three current workbooks under `packages/testing/fixtures/workbooks/`
- add synthetic broken fixtures for edge cases

## Unit Tests

- signature detection
- normalization dictionaries
- text repair
- canonical mapping
- aggregation formulas
- version pointer switching

## Integration Tests

- upload -> parse -> validate -> normalize -> publish
- failed validation does not switch active version
- rollback switches active version back
- premiums-only upload publishes partial dataset metadata correctly
- financial-only upload publishes partial dataset metadata correctly
- income-statement-only upload publishes metadata correctly when semantically recognizable
- combined upload with optional reference publishes correctly
- arbitrary workbook filenames do not affect correct classification
- premiums + detected incomeStatement still publish only operational domains without fake balance values
- incomeStatement-only upload is blocked as non-operational under the current two-source policy
- localized timestamp formatting remains stable and explicit in admin/public views
- staging run to dataset version traceability is visible in admin views

## E2E Tests

- admin uploads valid workbook set
- admin sees reconciliation report
- publish updates public site version metadata
- rollback restores previous version

## Negative Cases

- missing columns
- duplicate workbook roles
- corrupt zip
- encoded text issues
- inconsistent names
- mismatched periods
- reconciliation critical failure
- reference-only upload blocked
- type not allowed blocked
- charts without claims source rendered as unavailable
- unknown-but-safe workbook blocked as unclassified, not silently misclassified
- institution alias variants resolve to canonical institutions
- result-domain uploads never cause the public UI to fake supported balance or premium widgets
