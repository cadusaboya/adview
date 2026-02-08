import { useState, useEffect } from "react";
import { toast } from "sonner";

interface UseLoadAuxiliaryDataOptions<T> {
  loadFn: () => Promise<T>;
  onOpen: boolean;
  errorMessage?: string;
  cacheData?: boolean; // Se true, não recarrega se já houver dados
}

/**
 * Custom hook for loading auxiliary data (e.g., dropdown options) for forms
 *
 * @param options - Configuration object
 * @param options.loadFn - Async function that loads the data
 * @param options.onOpen - Trigger to reload data (typically when dialog opens)
 * @param options.errorMessage - Custom error message for toast
 * @returns Object with data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data: bancos, loading, error } = useLoadAuxiliaryData({
 *   loadFn: async () => {
 *     const res = await getBancos({ page_size: 1000 });
 *     return res.results;
 *   },
 *   onOpen: open,
 *   errorMessage: "Erro ao carregar bancos",
 * });
 * ```
 */
export function useLoadAuxiliaryData<T>({
  loadFn,
  onOpen,
  errorMessage = "Erro ao carregar dados",
  cacheData = true, // Por padrão, usa cache
}: UseLoadAuxiliaryDataOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Só carrega se o dialog está aberto E (não tem cache OU não tem dados ainda)
    if (onOpen && (!cacheData || !data)) {
      setLoading(true);
      setError(null);

      loadFn()
        .then((result) => {
          setData(result);
        })
        .catch((err) => {
          setError(err);
          toast.error(errorMessage);
          console.error(errorMessage, err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpen, errorMessage, cacheData]); // Removido data e loadFn das deps para evitar loops

  return { data, loading, error };
}
