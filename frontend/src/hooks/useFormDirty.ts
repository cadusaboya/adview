import { useEffect, useState } from 'react';

/**
 * Hook to track if a form has been modified (is "dirty")
 *
 * @param formData - Current form data object
 * @param initialData - Initial form data object to compare against
 * @returns isDirty - Boolean indicating if form has unsaved changes
 *
 * @example
 * ```tsx
 * const initialData = { name: '', email: '' };
 * const [formData, setFormData] = useState(initialData);
 * const isDirty = useFormDirty(formData, initialData);
 *
 * const handleClose = () => {
 *   if (isDirty && !confirm('Descartar alterações não salvas?')) {
 *     return;
 *   }
 *   onClose();
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormDirty<T extends Record<string, any>>(
  formData: T,
  initialData: T
): boolean {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // Compare form data with initial data
    const hasChanges = Object.keys(formData).some((key) => {
      const current = formData[key];
      const initial = initialData[key];

      // Handle null/undefined comparisons
      if (current === initial) return false;
      if (current == null && initial == null) return false;

      // Handle objects/arrays (shallow comparison)
      if (typeof current === 'object' && typeof initial === 'object') {
        return JSON.stringify(current) !== JSON.stringify(initial);
      }

      return current !== initial;
    });

    setIsDirty(hasChanges);
  }, [formData, initialData]);

  return isDirty;
}
