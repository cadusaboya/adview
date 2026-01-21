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
      }
    }
  
    return fallbackMessage;
  }
  