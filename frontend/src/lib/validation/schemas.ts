// Validation result type
export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string[]>;
};

// Field validator function type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldValidator<T> = (value: T, allValues?: any) => string | null;

// Validation schema type
export type ValidationSchema<T> = {
  [K in keyof T]?: FieldValidator<T[K]>[];
};

/**
 * Core validation runner
 * Executes all validators for each field in the schema
 *
 * @param data - Form data to validate
 * @param schema - Validation schema with validators for each field
 * @returns ValidationResult with valid flag and errors object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validate<T extends Record<string, any>>(
  data: T,
  schema: ValidationSchema<T>
): ValidationResult {
  const errors: Record<string, string[]> = {};
  let valid = true;

  for (const field in schema) {
    const validators = schema[field];
    const fieldErrors: string[] = [];

    if (validators) {
      for (const validator of validators) {
        const error = validator(data[field], data);
        if (error) {
          fieldErrors.push(error);
          valid = false;
        }
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }

  return { valid, errors };
}
