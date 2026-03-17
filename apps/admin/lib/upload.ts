const uploadFieldNames = ["premiums", "financialPosition", "reference"] as const;

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

  for (const field of uploadFieldNames) {
    const value = formData.get(field);
    if (isRealFile(value)) {
      forward.append(field, value, value.name);
    }
  }

  return forward;
}
