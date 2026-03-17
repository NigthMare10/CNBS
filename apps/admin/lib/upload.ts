const uploadFieldNames = ["workbooks", "premiums", "financialPosition", "incomeStatement", "reference"] as const;

function isRealFile(value: FormDataEntryValue | null): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.name.trim().length > 0 &&
    value.name.trim().toLowerCase() !== "blob"
  );
}

export function buildUploadFormData(formData: FormData): FormData {
  const forward = new FormData();

  const multipleFiles = formData.getAll("workbooks");
  if (multipleFiles.length > 0) {
    for (const value of multipleFiles) {
      if (isRealFile(value)) {
        forward.append("workbooks", value, value.name);
      }
    }

    return forward;
  }

  for (const field of uploadFieldNames) {
    if (field === "workbooks") {
      continue;
    }
    const value = formData.get(field);
    if (isRealFile(value)) {
      forward.append(field, value, value.name);
    }
  }

  return forward;
}
