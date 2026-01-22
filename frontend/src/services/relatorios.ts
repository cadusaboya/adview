// services/relatorios.ts

import { api } from "./api";

export async function getRelatorioCliente(clienteId: number) {
  const response = await api.get(
    `/api/relatorios/cliente/${clienteId}/`
  );

  return response.data;
}

/* ======================
   RELATÓRIO FUNCIONÁRIO
====================== */
export async function getRelatorioFuncionario(funcionarioId: number) {
  const response = await api.get(
    `/api/relatorios/funcionario/${funcionarioId}/`
  );

  return response.data;
}

export async function getDashboardData() {
  const response = await api.get("/api/dashboard/");
  return response.data;
}

export interface DREData {
  receitas: {
    fixas: number;
    variaveis: number;
    estornos: number;
    total: number;
  };
  despesas: {
    fixas: number;
    variaveis: number;
    comissoes: number;
    reembolsos: number;
    total: number;
  };
  resultado: number;
}

/**
 * Busca os dados da DRE consolidada
 * @param mes - Mês (1-12)
 * @param ano - Ano (YYYY)
 * @returns Dados da DRE consolidada
 */
export async function getDREConsolidado(
  mes: number,
  ano: number
): Promise<DREData> {
  try {
    const response = await api.get<DREData>('/api/relatorios/dre/', {
      params: {
        mes,
        ano,
      },
    });

    return response.data;
  } catch (error: unknown) {
    console.error('Erro ao buscar DRE:', error);
  
    if (error instanceof Error) {
      throw new Error(error.message);
    }
  
    throw new Error('Erro ao buscar dados da DRE');
  }
}
