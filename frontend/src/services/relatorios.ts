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

export interface BalancoData {
  entradas: {
    por_banco: Array<{ banco: string; valor: number }>;
    total: number;
  };
  saidas: {
    por_banco: Array<{ banco: string; valor: number }>;
    total: number;
  };
  resultado: number;
}

/**
 * Busca os dados do Fluxo de Caixa Realizado (Regime de Caixa)
 * @param mes - Mês (1-12)
 * @param ano - Ano (YYYY)
 * @returns Dados do Fluxo de Caixa com entradas e saídas por banco
 */
export async function getBalancoPatrimonial(
  mes: number,
  ano: number
): Promise<BalancoData> {
  try {
    const response = await api.get<BalancoData>('/api/relatorios/balanco/', {
      params: {
        mes,
        ano,
      },
    });

    return response.data;
  } catch (error: unknown) {
    console.error('Erro ao buscar Fluxo de Caixa:', error);

    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error('Erro ao buscar dados do Fluxo de Caixa');
  }
}

export interface LancamentoPendente {
  id: number;
  tipo: string;
  valor: number;
  valor_alocado: number;
  valor_nao_vinculado: number;
  data: string;
  observacao: string;
  conta_bancaria: string;
}

export interface Vinculo {
  tipo: string;
  descricao: string;
  valor: number;
}

export interface LancamentoConciliado {
  id: number;
  tipo: string;
  valor: number;
  data: string;
  observacao: string;
  conta_bancaria: string;
  vinculos: Vinculo[];
}

export interface ContaResumo {
  id: number;
  nome: string;
  total_lancamentos: number;
  conciliados: number;
  pendentes: number;
  entradas: number;
  saidas: number;
}

export interface ConciliacaoBancariaRelatorioData {
  periodo: {
    mes: number;
    ano: number;
    data_inicio: string;
    data_fim: string;
  };
  resumo: {
    total_lancamentos: number;
    total_conciliados: number;
    total_nao_conciliados: number;
    percentual_conciliado: number;
    status_geral: string;
    status_cor: string;
  };
  valores: {
    total_entradas: number;
    total_saidas: number;
    saldo_periodo: number;
    entradas_conciliadas: number;
    saidas_conciliadas: number;
    entradas_pendentes: number;
    saidas_pendentes: number;
  };
  vinculacoes: {
    receitas: {
      quantidade: number;
      valor_total: number;
    };
    despesas: {
      quantidade: number;
      valor_total: number;
    };
    custodias: {
      quantidade: number;
      valor_total: number;
    };
  };
  por_conta: ContaResumo[];
  lancamentos_pendentes: LancamentoPendente[];
  lancamentos_conciliados_recentes: LancamentoConciliado[];
  total_pendentes_exibidos: number;
  total_pendentes: number;
}

/**
 * Busca o relatório completo de conciliação bancária mensal
 * @param mes - Mês (1-12)
 * @param ano - Ano (YYYY)
 * @param contaBancariaId - (opcional) ID da conta bancária específica
 * @returns Dados completos da conciliação bancária
 */
export async function getRelatorioConciliacaoBancaria(
  mes: number,
  ano: number,
  contaBancariaId?: number
): Promise<ConciliacaoBancariaRelatorioData> {
  try {
    const params: { mes: number; ano: number; conta_bancaria_id?: number } = {
      mes,
      ano,
    };

    if (contaBancariaId) {
      params.conta_bancaria_id = contaBancariaId;
    }

    const response = await api.get<ConciliacaoBancariaRelatorioData>(
      '/api/relatorios/conciliacao-bancaria/',
      { params }
    );

    return response.data;
  } catch (error: unknown) {
    console.error('Erro ao buscar relatório de conciliação bancária:', error);

    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error('Erro ao buscar relatório de conciliação bancária');
  }
}
