import { FieldValidator } from './schemas';

/**
 * Validates that a field is not empty
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const required = (message = "Campo obrigatório"): FieldValidator<any> =>
  (value) => {
    if (value === null || value === undefined || value === "" || (typeof value === 'number' && value === 0)) {
      return message;
    }
    return null;
  };

/**
 * Validates email format
 */
export const email = (message = "Email inválido"): FieldValidator<string> =>
  (value) => {
    if (!value) return null; // Let required handle emptiness
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : message;
  };

/**
 * Validates CPF (Brazilian individual taxpayer registry)
 */
export const cpf = (message = "CPF inválido"): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    const numbers = value.replace(/\D/g, "");

    if (numbers.length !== 11) return message;

    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(numbers)) return message;

    // Validate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(numbers[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[9])) return message;

    // Validate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(numbers[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers[10])) return message;

    return null;
  };

/**
 * Validates CNPJ (Brazilian company taxpayer registry)
 */
export const cnpj = (message = "CNPJ inválido"): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    const numbers = value.replace(/\D/g, "");

    if (numbers.length !== 14) return message;

    // Check for known invalid CNPJs
    if (/^(\d)\1{13}$/.test(numbers)) return message;

    // Validate first check digit
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(numbers[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(numbers[12])) return message;

    // Validate second check digit
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(numbers[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (digit2 !== parseInt(numbers[13])) return message;

    return null;
  };

/**
 * Validates either CPF or CNPJ format
 */
export const cpfOrCnpj = (message = "CPF/CNPJ inválido"): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    const numbers = value.replace(/\D/g, "");

    if (numbers.length === 11) {
      return cpf(message)(value);
    } else if (numbers.length === 14) {
      return cnpj(message)(value);
    }

    return message;
  };

/**
 * Validates Brazilian phone number format
 */
export const phone = (message = "Telefone inválido"): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    const numbers = value.replace(/\D/g, "");
    return numbers.length >= 10 && numbers.length <= 11 ? null : message;
  };

/**
 * Validates minimum numeric value
 */
export const minValue = (min: number, message?: string): FieldValidator<number | string> =>
  (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return message || "Valor inválido";
    return numValue >= min ? null : message || `Valor mínimo: ${min}`;
  };

/**
 * Validates maximum numeric value
 */
export const maxValue = (max: number, message?: string): FieldValidator<number | string> =>
  (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return message || "Valor inválido";
    return numValue <= max ? null : message || `Valor máximo: ${max}`;
  };

/**
 * Validates minimum string length
 */
export const minLength = (min: number, message?: string): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    return value.length >= min ? null : message || `Mínimo ${min} caracteres`;
  };

/**
 * Validates maximum string length
 */
export const maxLength = (max: number, message?: string): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    return value.length <= max ? null : message || `Máximo ${max} caracteres`;
  };

/**
 * Validates against a regex pattern
 */
export const pattern = (regex: RegExp, message: string): FieldValidator<string> =>
  (value) => {
    if (!value) return null;
    return regex.test(value) ? null : message;
  };

/**
 * Custom validation function
 */
export const custom = <T>(
  validatorFn: (value: T, allValues?: unknown) => boolean,
  message: string
): FieldValidator<T> =>
  (value, allValues) => {
    return validatorFn(value, allValues) ? null : message;
  };

/**
 * Conditional validator - only validates if condition is true
 */
export const when = <T>(
  condition: (allValues: unknown) => boolean,
  validator: FieldValidator<T>
): FieldValidator<T> =>
  (value, allValues) => {
    return condition(allValues) ? validator(value, allValues) : null;
  };
