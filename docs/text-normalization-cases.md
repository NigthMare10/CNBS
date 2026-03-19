# Text Normalization Cases

Living catalog of conflictive text variants that the CNBS publication pipeline already resolves or deliberately leaves unresolved when the match is not safe.

## How to use this file

- add a new row when a real workbook introduces a new textual variant
- record the exact original value observed in the workbook
- record the normalized value used by the matcher
- document whether the case resolves safely, falls back by line number, or stays ambiguous/unresolved

## Resolved Cases

| Original | Normalized | Domain | Mapping decision |
|---|---|---|---|
| `CrÃ©ditos Diferidos` | `CREDITOS DIFERIDOS` | financial account | Resolve to `CRÉDITOS DIFERIDOS` via normalized alias after mojibake repair |
| `Propiedades de InversiÃ³n` | `PROPIEDADES DE INVERSION` | financial account | Resolve to `PROPIEDADES DE INVERSIÓN` via normalized alias after mojibake repair |
| `Reservas TÃ©cnicas y MatemÃ¡ticas` | `RESERVAS TECNICAS Y MATEMATICAS` | financial account | Resolve to `RESERVAS TÉCNICAS Y MATEMÁTICAS` via normalized alias after mojibake repair |
| `Casco Marit铆mo` | `CASCO MARITIMO` | insurance line | Resolve to `CASCO MARÍTIMO` after repair plus accent-insensitive normalization |
| `otros seguros generales  /  ganadero` | `OTROS SEGUROS GENERALES GANADERO` | insurance line | Resolve to `GANADERO` via normalized alias with slash and double-space cleanup |
| `  seguros del pais  ` | `SEGUROS DEL PAIS` | institution | Resolve to `SEGUROS DEL PAÍS` via normalized alias after case and spacing cleanup |
| `Cr?ditos raros` with line `24` | `CR?DITOS RAROS` | financial account | Do not trust text; resolve by line-number fallback to `CRÉDITOS DIFERIDOS` |

## Ambiguous or Unsafe Cases

| Original | Normalized | Domain | Mapping decision |
|---|---|---|---|
| `TOTAL` | `TOTAL` | financial account | Leave as ambiguous when no authoritative line number is available because multiple canonical accounts remain viable |

## Notes

- `repairedByNormalization` counts attempts where text had to be normalized before a safe outcome was possible
- `textsRequiringMojibakeRepair` counts the subset that needed mojibake repair specifically
- `fallbackByLineNumber` remains visible as a separate outcome; it does not silently masquerade as a direct alias match
- evidence now remains visible in staging metadata, published metadata, audit events, `/reconciliation`, and `/api/admin/system/status`
