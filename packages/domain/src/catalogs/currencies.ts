export interface CurrencyDefinition {
  currencyId: string;
  code: string;
  name: string;
  kind: "national" | "foreign" | "mixed";
}

export const currenciesCatalog: CurrencyDefinition[] = [
  { currencyId: "hnl", code: "1", name: "Nacional", kind: "national" },
  { currencyId: "usd", code: "2", name: "Extranjera", kind: "foreign" },
  { currencyId: "mixed", code: "MIXED", name: "Combinada", kind: "mixed" }
];
