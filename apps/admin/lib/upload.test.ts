import { describe, expect, it } from "vitest";
import { buildUploadFormData } from "./upload";

describe("buildUploadFormData", () => {
  it("skips empty placeholder files so blob uploads are not forwarded", () => {
    const formData = new FormData();
    formData.append("premiums", new File([new Uint8Array([1, 2, 3])], "Primas.xlsx"));
    formData.append("financialPosition", new File([], ""));
    formData.append("reference", new File([], "blob"));

    const forwarded = buildUploadFormData(formData);

    expect(Array.from(forwarded.keys())).toEqual(["premiums"]);
  });

  it("forwards the two real files without adding a phantom third file", () => {
    const formData = new FormData();
    formData.append("premiums", new File([new Uint8Array([1, 2, 3])], "Primas.xlsx"));
    formData.append("financialPosition", new File([new Uint8Array([4, 5, 6])], "EstadoSituacionFinanciera.xlsx"));

    const forwarded = buildUploadFormData(formData);

    expect(Array.from(forwarded.keys())).toEqual(["premiums", "financialPosition"]);
  });
});
