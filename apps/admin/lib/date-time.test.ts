import { describe, expect, it } from "vitest";
import { adminTimeZoneLabel, formatAdminDateTime } from "./date-time";

describe("formatAdminDateTime", () => {
  it("formats timestamps with configured timezone context", () => {
    const formatted = formatAdminDateTime("2026-03-17T12:00:00.000Z");
    expect(formatted.length).toBeGreaterThan(0);
    expect(adminTimeZoneLabel()).toBeTruthy();
  });
});
