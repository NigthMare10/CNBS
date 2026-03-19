# Trazabilidad Operativa

## Identidad de cada corrida

Toda corrida en staging tiene:

- `ingestionRunId`
- `createdAt`
- `uploadedBy`
- `publicationState`
- `sourceFiles`
- `mappingSummary`
- `validationSummary`
- `reconciliationSummary`

## Identidad de cada version publicada

Toda version publicada tiene:

- `datasetVersionId`
- `ingestionRunId`
- `createdAt`
- `publishedAt`
- `datasetScope`
- `domainAvailability`
- `validationSummary`
- `reconciliationSummary`

## Cadena de trazabilidad

La cadena operativa completa es:

`upload -> staging -> validate -> reconcile -> publish -> active version -> rollback`

Esto permite responder:

- que corrida genero cada version
- que version esta activa
- cuando se publico
- que archivos alimentaron la corrida
- que coverage produjo la publicacion

## Superficies administrativas

### Upload

- muestra la ultima corrida detectada
- conserva evidencia de clasificacion por firma

### Ingestions

- lista corridas en staging
- muestra estado de publicacion
- marca cuando una corrida genero la version activa

### Reconciliation

- muestra la corrida solicitada o la mas reciente
- resume reparaciones de texto, aliases resueltos, ambiguos y no resueltos
- conserva el JSON tecnico completo de la corrida

### Publish

- distingue corridas ya publicadas
- bloquea visualmente corridas no publicables
- muestra cuando una corrida ya corresponde a la version activa

### Publications / History

- muestran versiones publicadas
- permiten rollback controlado

### Audit

- muestra actor, accion, corrida, dataset y timestamp
- conserva resumen de calidad de texto en eventos relevantes

## Timezone

- los timestamps se almacenan en UTC ISO
- la UI administrativa se renderiza en `America/Tegucigalpa`
- la zona horaria debe mostrarse de forma explicita en superficies operativas
