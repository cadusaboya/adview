import { useState, useCallback } from "react";
import { validate, ValidationSchema, ValidationResult } from "@/lib/validation/schemas";

export type FormErrors = Record<string, string[]>;

export interface UseFormValidationReturn<T> {
  // Form state
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;

  // Error state
  errors: FormErrors;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  setFieldError: (field: string, error: string) => void;

  // Validation
  validateForm: () => boolean;
  validateField: (field: keyof T) => boolean;

  // Submit handling
  isSubmitting: boolean;
  handleSubmit: (onValid: (data: T) => Promise<void>) => Promise<void>;

  // Field helpers
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    onChange: (value: any) => void;
    onBlur: () => void;
    error: string | undefined;
  };
}

/**
 * Custom hook for form validation with client-side and server-side error handling
 *
 * @param initialData - Initial form data
 * @param schema - Validation schema with validators for each field
 * @returns Form state, validation functions, and field helpers
 *
 * @example
 * ```tsx
 * const { formData, errors, handleSubmit, getFieldProps } = useFormValidation(
 *   { nome: "", email: "" },
 *   { nome: [required()], email: [required(), email()] }
 * );
 * ```
 */
export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  schema: ValidationSchema<T>
): UseFormValidationReturn<T> {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [field]: [error],
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const result = validate(formData, schema);
    setErrors(result.errors);
    return result.valid;
  }, [formData, schema]);

  const validateField = useCallback(
    (field: keyof T): boolean => {
      const fieldSchema = { [field]: schema[field] } as ValidationSchema<T>;
      const result = validate(formData, fieldSchema);

      if (result.errors[field as string]) {
        setErrors((prev) => ({
          ...prev,
          [field as string]: result.errors[field as string],
        }));
        return false;
      } else {
        clearFieldError(field as string);
        return true;
      }
    },
    [formData, schema, clearFieldError]
  );

  const handleSubmit = useCallback(
    async (onValid: (data: T) => Promise<void>) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      const isValid = validateForm();

      if (isValid) {
        try {
          await onValid(formData);
          clearErrors();
        } catch (error) {
          // Backend errors will be handled by the component
          throw error;
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setIsSubmitting(false);
      }
    },
    [formData, isSubmitting, validateForm, clearErrors]
  );

  const getFieldProps = useCallback(
    (field: keyof T) => ({
      value: formData[field],
      onChange: (value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error when user types (only if field was touched)
        if (touchedFields.has(field as string)) {
          clearFieldError(field as string);
        }
      },
      onBlur: () => {
        setTouchedFields((prev) => new Set(prev).add(field as string));
        validateField(field);
      },
      error: errors[field as string]?.[0],
    }),
    [formData, errors, touchedFields, validateField, clearFieldError]
  );

  return {
    formData,
    setFormData,
    errors,
    clearErrors,
    clearFieldError,
    setFieldError,
    validateForm,
    validateField,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  };
}
