import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormSelectProps {
  label?: string;
  error?: string;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  helpText?: string;
}

/**
 * Form select component with label, error display, and validation styling
 *
 * @example
 * ```tsx
 * <FormSelect
 *   label="Tipo"
 *   required
 *   value={formData.tipo}
 *   onValueChange={(val) => setFormData({ ...formData, tipo: val })}
 *   options={[
 *     { value: "F", label: "Fixo" },
 *     { value: "A", label: "Avulso" },
 *   ]}
 *   error={errors.tipo}
 * />
 * ```
 */
export function FormSelect({
  label,
  error,
  required,
  value,
  onValueChange,
  placeholder,
  options,
  disabled,
  helpText,
}: FormSelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          className={cn(error && "border-red-500 focus:ring-red-500")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
