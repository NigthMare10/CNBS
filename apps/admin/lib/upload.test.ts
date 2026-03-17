import { describe, expect, it } from "vitest";
import { buildUploadFormData } from "./upload";

describe("buildUploadFormData", () => {
  it("skips empty placeholder files so blob uploads are not forwarded", () => {
    const formData = new FormData();
    formData.append("workbooks", new File([new Uint8Array([1, 2, 3])], "Primas.xlsx"));
    formData.append("workbooks", new File([], ""));
    formData.append("workbooks", new File([], "blob"));

    const forwarded = buildUploadFormData(formData);

    expect(Array.from(forwarded.keys())).toEqual(["workbooks"]);
  });

  it("forwards the two real files without adding a phantom third file", () => {
    const formData = new FormData();
    formData.append("workbooks", new File([new Uint8Array([1, 2, 3])], "Primas.xlsx"));
    formData.append("workbooks", new File([new Uint8Array([4, 5, 6])], "EstadoSituacionFinanciera.xlsx"));

    const forwarded = buildUploadFormData(formData);

    expect(Array.from(forwarded.keys())).toEqual(["workbooks", "workbooks"]);
  });

  it("preserves incomeStatement as a real third operational source when provided", () => {
    const formData = new FormData();
    formData.append("workbooks", new File([new Uint8Array([1])], "Primas (2).xlsx"));
    formData.append("workbooks", new File([new Uint8Array([2])], "EstadoResultado.xlsx"));

    const forwarded = buildUploadFormData(formData);

    expect(Array.from(forwarded.keys())).toEqual(["workbooks", "workbooks"]);
  });
});
