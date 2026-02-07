export type FormErrors = Record<string, string[]>;

/**
 * Parses Django REST Framework error responses into form errors
 *
 * DRF can return errors in multiple formats:
 * 1. Field validation: { "field_name": ["error1", "error2"] }
 * 2. General error: { "detail": "error message" }
 * 3. Custom error: { "error": "error message" }
 *
 * @param error - The error object from axios/fetch
 * @returns Object with fieldErrors and generalError
 */
export function parseDRFErrors(error: unknown): {
  fieldErrors: FormErrors;
  generalError: string | null;
} {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: {
        status?: number;
        data?: unknown;
      };
    }).response;

    const data = response?.data;

    if (typeof data === "object" && data !== null) {
      const fieldErrors: FormErrors = {};
      let generalError: string | null = null;

      // Handle detail/error at root level (general errors)
      if ("detail" in data && typeof (data as any).detail === "string") {
        generalError = (data as any).detail;
      } else if ("error" in data && typeof (data as any).error === "string") {
        generalError = (data as any).error;
      }

      // Handle field-level errors (DRF format)
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          // DRF returns field errors as arrays of strings
          fieldErrors[key] = value.map((v) =>
            typeof v === "string" ? v : String(v)
          );
        }
      }

      // If we have field errors but no general error, don't return a general error
      // If we have neither, return a fallback general error
      if (Object.keys(fieldErrors).length === 0 && !generalError) {
        generalError = "Erro ao processar a requisição";
      }

      return { fieldErrors, generalError };
    }

    // If response.data is a string, treat it as a general error
    if (typeof data === "string") {
      return {
        fieldErrors: {},
        generalError: data,
      };
    }
  }

  return {
    fieldErrors: {},
    generalError: "Erro inesperado ao processar a requisição",
  };
}

/**
 * Integrates backend errors into form validation state
 *
 * @param setFieldError - Function to set error for a specific field
 * @param error - The error object from axios/fetch
 * @returns General error message (for toast) or null if only field errors
 */
export function applyBackendErrors(
  setFieldError: (field: string, error: string) => void,
  error: unknown
): string | null {
  const { fieldErrors, generalError } = parseDRFErrors(error);

  // Apply field-level errors
  Object.entries(fieldErrors).forEach(([field, errors]) => {
    if (errors.length > 0) {
      setFieldError(field, errors[0]); // Show first error for each field
    }
  });

  // Return general error for toast notification
  // Only return if there are no field errors, or if it's a non-field error
  if (Object.keys(fieldErrors).length === 0 && generalError) {
    return generalError;
  }

  // If we have field errors, return a generic message
  if (Object.keys(fieldErrors).length > 0) {
    return generalError || "Corrija os erros nos campos destacados";
  }

  return generalError;
}
