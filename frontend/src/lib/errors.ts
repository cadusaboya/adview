export function getErrorMessage(
    error: unknown,
    fallbackMessage = 'Erro inesperado'
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error
    ) {
      const response = (error as {
        response?: {
          status?: number;
          data?: unknown;
        };
      }).response;

      if (response?.status === 401) {
        return 'Não autorizado. Faça login novamente.';
      }

      const data = response?.data;

      if (typeof data === 'string') {
        return data;
      }

      if (typeof data === 'object' && data !== null) {
        // Handle Django REST Framework field validation errors
        if ('nome' in data && Array.isArray((data as { nome?: unknown }).nome)) {
          const nomeErrors = (data as { nome: string[] }).nome;
          if (nomeErrors.some(err => err.includes('already exists'))) {
            return 'Já existe um registro com este nome. Por favor, use um nome diferente.';
          }
          return nomeErrors[0];
        }

        if (
          'error' in data &&
          typeof (data as { error?: unknown }).error === 'string'
        ) {
          return (data as { error: string }).error;
        }

        if (
          'detail' in data &&
          typeof (data as { detail?: unknown }).detail === 'string'
        ) {
          return (data as { detail: string }).detail;
        }

        // Handle other field validation errors
        const firstKey = Object.keys(data)[0];
        if (firstKey && Array.isArray((data as Record<string, unknown>)[firstKey])) {
          const errors = (data as Record<string, string[]>)[firstKey];
          return errors[0];
        }
      }
    }

    return fallbackMessage;
  }
  