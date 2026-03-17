import { displayConfig } from "@cnbs/config";

export function formatAdminDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Dato no disponible";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(displayConfig.locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: displayConfig.timeZone,
    timeZoneName: "short"
  }).format(date);
}

export function adminTimeZoneLabel(): string {
  return displayConfig.timeZone;
}
