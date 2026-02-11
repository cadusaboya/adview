/**
 * Serviço para geração de relatórios em PDF
 * Integra com as APIs de relatórios do backend usando axios
 */

import { api } from './api';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { getErrorMessage } from '@/lib/errors';

/* =========================
   TIPOS DE PAYLOAD
========================= */

// 🔹 Payload específico para recibo
export interface RelatorioReciboPayload {
  payment_id: number;
}

// 🔹 Payload específico para DRE
export interface RelatorioDREPayload {
  mes: number;
  ano: number;
}

// 🔹 Payload específico para Comissionamento
export interface RelatorioComissionamentoPayload {
  mes: number;
  ano: number;
  funcionario_id?: number;
}

/* =========================
   TIPOS DE RELATÓRIO
========================= */

type TipoRelatorioLista =
  | 'receitas-pagas'
  | 'cliente-especifico'
  | 'funcionario-especifico'
  | 'despesas-pagas'
  | 'despesas-a-pagar'
  | 'receitas-a-receber'
  | 'fluxo-de-caixa';

// 🔹 Payload específico para Balanço
export interface RelatorioBalancoPayload {
  mes: number;
  ano: number;
  agrupamento?: 'banco' | 'tipo';
  incluir_custodias?: boolean;
}

type TipoRelatorioDRE = 'dre-consolidado';
type TipoRelatorioRecibo = 'recibo-pagamento';
type TipoRelatorioComissionamento = 'comissionamento';
type TipoRelatorioBalanco = 'balanco';

export type TipoRelatorio =
  | TipoRelatorioLista
  | TipoRelatorioDRE
  | TipoRelatorioRecibo
  | TipoRelatorioComissionamento
  | TipoRelatorioBalanco;

/* =========================
   CONFIG
========================= */

interface RelatorioConfig {
  endpoint: string;
  nomeArquivo: string;
}

const RELATORIOS: Record<TipoRelatorio, RelatorioConfig> = {
  'receitas-pagas': {
    endpoint: '/api/pdf/receitas-pagas/',
    nomeArquivo: 'relatorio_receitas_pagas.pdf',
  },
  'cliente-especifico': {
    endpoint: '/api/pdf/cliente-especifico/',
    nomeArquivo: 'relatorio_cliente.pdf',
  },
  'funcionario-especifico': {
    endpoint: '/api/pdf/funcionario-especifico/',
    nomeArquivo: 'relatorio_funcionario.pdf',
  },
  'despesas-pagas': {
    endpoint: '/api/pdf/despesas-pagas/',
    nomeArquivo: 'relatorio_despesas_pagas.pdf',
  },
  'despesas-a-pagar': {
    endpoint: '/api/pdf/despesas-a-pagar/',
    nomeArquivo: 'relatorio_despesas_a_pagar.pdf',
  },
  'receitas-a-receber': {
    endpoint: '/api/pdf/receitas-a-receber/',
    nomeArquivo: 'relatorio_receitas_a_receber.pdf',
  },
  'dre-consolidado': {
    endpoint: '/api/pdf/dre/',
    nomeArquivo: 'relatorio_dre_consolidado.pdf',
  },
  'fluxo-de-caixa': {
    endpoint: '/api/pdf/fluxo-de-caixa/',
    nomeArquivo: 'relatorio_fluxo_caixa.pdf',
  },
  'recibo-pagamento': {
    endpoint: '/api/pdf/recibo-pagamento/',
    nomeArquivo: 'recibo_pagamento.pdf',
  },
  'comissionamento': {
    endpoint: '/api/pdf/comissionamento/',
    nomeArquivo: 'relatorio_comissionamento.pdf',
  },
  'balanco': {
    endpoint: '/api/pdf/balanco/',
    nomeArquivo: 'relatorio_balanco.pdf',
  },
};

/* =========================
   GERAR RELATÓRIO (OVERLOADS)
========================= */

// 🔹 Relatórios padrão
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorioLista,
  filtros: RelatorioFiltros
): Promise<void>;

// 🔹 DRE
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorioDRE,
  filtros: RelatorioDREPayload
): Promise<void>;

// 🔹 Recibo
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorioRecibo,
  filtros: RelatorioReciboPayload
): Promise<void>;

// 🔹 Comissionamento
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorioComissionamento,
  filtros: RelatorioComissionamentoPayload
): Promise<void>;

// 🔹 Balanço
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorioBalanco,
  filtros: RelatorioBalancoPayload
): Promise<void>;

// 🔹 Implementação
export async function gerarRelatorioPDF(
  tipoRelatorio: TipoRelatorio,
  filtros: RelatorioFiltros | RelatorioReciboPayload | RelatorioDREPayload | RelatorioComissionamentoPayload | RelatorioBalancoPayload
): Promise<void> {
  const config = RELATORIOS[tipoRelatorio];

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Gerando relatório:', tipoRelatorio);
      console.log('Filtros:', filtros);
    }

    const response = await api.get(config.endpoint, {
      params: filtros,
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: 'application/pdf',
    });

    const urlBlob = window.URL.createObjectURL(blob);
    window.open(urlBlob, '_blank');

    setTimeout(() => {
      window.URL.revokeObjectURL(urlBlob);
    }, 100);
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Erro ao gerar relatório'));
  }
}

/* =========================
   BAIXAR RELATÓRIO
========================= */

export async function baixarRelatorioPDF(
  tipoRelatorio: TipoRelatorioLista,
  filtros: RelatorioFiltros
): Promise<void> {
  const config = RELATORIOS[tipoRelatorio];

  try {
    const response = await api.get(config.endpoint, {
      params: filtros,
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: 'application/pdf',
    });

    const link = document.createElement('a');
    const urlBlob = window.URL.createObjectURL(blob);

    link.href = urlBlob;
    link.download = config.nomeArquivo;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(urlBlob);
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Erro ao baixar relatório'));
  }
}

/* =========================
   HELPERS
========================= */

export const TIPOS_RELATORIOS = Object.keys(RELATORIOS) as TipoRelatorio[];

export function obterConfigRelatorio(
  tipoRelatorio: TipoRelatorio
): RelatorioConfig {
  return RELATORIOS[tipoRelatorio];
}

export function ehRelatorioValido(
  tipoRelatorio: string
): tipoRelatorio is TipoRelatorio {
  return tipoRelatorio in RELATORIOS;
}

export function obterNomeRelatorio(tipoRelatorio: TipoRelatorio): string {
  const nomes: Record<TipoRelatorio, string> = {
    'receitas-pagas': 'Relatório de Receitas Pagas',
    'cliente-especifico': 'Relatório de Cliente Específico',
    'funcionario-especifico': 'Relatório de Funcionário/Fornecedor',
    'despesas-pagas': 'Relatório de Despesas Pagas',
    'despesas-a-pagar': 'Relatório de Despesas a Pagar',
    'receitas-a-receber': 'Relatório de Receitas a Receber',
    'dre-consolidado': 'Demonstração de Resultado do Exercício (DRE)',
    'fluxo-de-caixa': 'Relatório de Fluxo de Caixa',
    'recibo-pagamento': 'Recibo de Pagamento',
    'comissionamento': 'Relatório de Comissionamento',
    'balanco': 'Fluxo de Caixa Realizado (Balanço)',
  };

  return nomes[tipoRelatorio];
}
