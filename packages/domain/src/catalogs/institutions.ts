import type { Institution, InstitutionAlias } from "../entities/canonical";

export const institutionsCatalog: Institution[] = [
  { institutionId: "davivienda", canonicalCode: "601", canonicalName: "SEGUROS DAVIVIENDA", displayName: "Seguros Davivienda", shortName: "Davivienda", active: true },
  { institutionId: "palic", canonicalCode: "602", canonicalName: "PALIC", displayName: "PALIC", shortName: "PALIC", active: true },
  { institutionId: "mapfre", canonicalCode: "603", canonicalName: "MAPFRE SEGUROS", displayName: "Mapfre Seguros", shortName: "Mapfre", active: true },
  { institutionId: "ficohsa", canonicalCode: "604", canonicalName: "FICOHSA SEGUROS", displayName: "Ficohsa Seguros", shortName: "Ficohsa", active: true },
  { institutionId: "continental", canonicalCode: "606", canonicalName: "SEGUROS CONTINENTAL", displayName: "Seguros Continental", shortName: "Continental", active: true },
  { institutionId: "atlantida", canonicalCode: "608", canonicalName: "SEGUROS ATLÁNTIDA", displayName: "Seguros Atlántida", shortName: "Atlántida", active: true },
  { institutionId: "crefisa", canonicalCode: "609", canonicalName: "CREFISA", displayName: "Crefisa", shortName: "Crefisa", active: true },
  { institutionId: "equidad", canonicalCode: "612", canonicalName: "SEGUROS EQUIDAD, S.A.", displayName: "Seguros Equidad", shortName: "Equidad", active: true },
  { institutionId: "del-pais", canonicalCode: "613", canonicalName: "SEGUROS DEL PAÍS", displayName: "Seguros del País", shortName: "Del País", active: true },
  { institutionId: "lafise", canonicalCode: "615", canonicalName: "SEGUROS LAFISE", displayName: "Seguros Lafise", shortName: "Lafise", active: true },
  { institutionId: "rural", canonicalCode: "617", canonicalName: "ASEGURADORA RURAL", displayName: "Aseguradora Rural", shortName: "Rural", active: true },
  { institutionId: "assa", canonicalCode: "618", canonicalName: "ASSA CIA. DE SEGUROS", displayName: "ASSA Cia. de Seguros", shortName: "ASSA", active: true }
];

export const institutionAliases: InstitutionAlias[] = [
  { alias: "SEGUROS DAVIVIENDA", institutionId: "davivienda", source: "dictionary" },
  { alias: "DAVIVIENDA", institutionId: "davivienda", source: "dictionary" },
  { alias: "PALIC", institutionId: "palic", source: "dictionary" },
  { alias: "MAPFRE SEGUROS", institutionId: "mapfre", source: "dictionary" },
  { alias: "FICOHSA SEGUROS", institutionId: "ficohsa", source: "dictionary" },
  { alias: "SEGUROS CONTINENTAL", institutionId: "continental", source: "dictionary" },
  { alias: "SEGUROS ATLANTIDA", institutionId: "atlantida", source: "dictionary" },
  { alias: "SEGUROS ATLÁNTIDA", institutionId: "atlantida", source: "dictionary" },
  { alias: "ATLANTIDA", institutionId: "atlantida", source: "dictionary" },
  { alias: "CREFISA", institutionId: "crefisa", source: "dictionary" },
  { alias: "SEGUROS EQUIDAD, S.A.", institutionId: "equidad", source: "dictionary" },
  { alias: "SEGUROS EQUIDAD", institutionId: "equidad", source: "dictionary" },
  { alias: "EQUIDAD", institutionId: "equidad", source: "dictionary" },
  { alias: "SEGUROS DEL PAIS", institutionId: "del-pais", source: "dictionary" },
  { alias: "SEGUROS DEL PAÍS", institutionId: "del-pais", source: "dictionary" },
  { alias: "SEGUROS DEL PAIS ", institutionId: "del-pais", source: "dictionary" },
  { alias: "SEGUROS LAFISE", institutionId: "lafise", source: "dictionary" },
  { alias: "LAFISE", institutionId: "lafise", source: "dictionary" },
  { alias: "ASRURAL HN", institutionId: "rural", source: "dictionary" },
  { alias: "ASEGURADORA RURAL", institutionId: "rural", source: "dictionary" },
  { alias: "BANRURAL", institutionId: "rural", source: "dictionary" },
  { alias: "ASSA", institutionId: "assa", source: "dictionary" },
  { alias: "ASSA CIA. DE SEGUROS", institutionId: "assa", source: "dictionary" }
];
