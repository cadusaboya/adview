import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FormTextareaProps extends React.ComponentProps<typeof Textarea> {
  label?: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

/**
 * Form textarea component with label, error display, and validation styling
 *
 * @example
 * ```tsx
 * <FormTextarea
 *   label="Descrição"
 *   value={formData.descricao}
 *   onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
 *   error={errors.descricao}
 *   rows={3}
 * />
 * ```
 */
export function FormTextarea({
  label,
  error,
  required,
  helpText,
  className,
  ...props
}: FormTextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <Textarea
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
