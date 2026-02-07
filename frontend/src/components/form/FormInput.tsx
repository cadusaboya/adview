import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormInputProps extends React.ComponentProps<typeof Input> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

/**
 * Form input component with label, error display, and validation styling
 *
 * @example
 * ```tsx
 * <FormInput
 *   label="Nome"
 *   required
 *   value={formData.nome}
 *   onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
 *   error={errors.nome}
 * />
 * ```
 *
 * Or with useFormValidation:
 * ```tsx
 * <FormInput
 *   label="Nome"
 *   required
 *   {...getFieldProps("nome")}
 * />
 * ```
 */
export function FormInput({
  label,
  error,
  required,
  helpText,
  className,
  ...props
}: FormInputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Input
        className={cn(
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        {...props}
      />
      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span className="font-medium">⚠</span> {error}
        </p>
      )}
    </div>
  );
}
