/**
 * Serviço para geração de relatórios em PDF
 * Integra com as APIs de relatórios do backend usando axios
 */

import { api } from './api';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { getErrorMessage } from '@/lib/errors';

interface RelatorioConfig {
  endpoint: string;
  nomeArquivo: string;
}

const RELATORIOS: Record<string, RelatorioConfig> = {
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
};

/**
 * Gera um relatório em PDF com os filtros especificados e abre no navegador
 * Faz a requisição com autenticação e abre o blob em nova aba
 * @param tipoRelatorio - Tipo de relatório a gerar
 * @param filtros - Filtros a aplicar
 * @throws Error se o tipo de relatório for inválido ou houver erro na requisição
 */
export async function gerarRelatorioPDF(
  tipoRelatorio: string,
  filtros: RelatorioFiltros
): Promise<void> {
  const config = RELATORIOS[tipoRelatorio];

  if (!config) {
    throw new Error(`Tipo de relatório inválido: ${tipoRelatorio}`);
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Gerando relatório:', tipoRelatorio);
      console.log('Filtros:', filtros);
    }

    // Fazer requisição com axios (que envia o token automaticamente)
    const response = await api.get(config.endpoint, {
      params: filtros,
      responseType: 'blob', // Receber como blob para PDF
    });

    // Criar blob do PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });

    // Criar URL do blob
    const urlBlob = window.URL.createObjectURL(blob);

    // Abrir em nova aba
    window.open(urlBlob, '_blank');

    // Limpar URL do blob após um tempo (para não vazar memória)
    setTimeout(() => {
      window.URL.revokeObjectURL(urlBlob);
    }, 100);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Relatório aberto em nova aba');
    }
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Erro ao gerar relatório'));
  }  
}

/**
 * Faz download do relatório em PDF
 * @param tipoRelatorio - Tipo de relatório a gerar
 * @param filtros - Filtros a aplicar
 * @throws Error se o tipo de relatório for inválido ou houver erro na requisição
 */
export async function baixarRelatorioPDF(
  tipoRelatorio: string,
  filtros: RelatorioFiltros
): Promise<void> {
  const config = RELATORIOS[tipoRelatorio];

  if (!config) {
    throw new Error(`Tipo de relatório inválido: ${tipoRelatorio}`);
  }

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Baixando relatório:', tipoRelatorio);
      console.log('Filtros:', filtros);
    }

    // Fazer requisição com axios
    const response = await api.get(config.endpoint, {
      params: filtros,
      responseType: 'blob', // Importante: receber como blob para PDF
    });

    // Criar blob do PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });

    // Criar link de download
    const link = document.createElement('a');
    const urlBlob = window.URL.createObjectURL(blob);
    link.href = urlBlob;
    link.download = config.nomeArquivo;

    // Disparar download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(urlBlob);

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Relatório baixado:', config.nomeArquivo);
    }
  } catch (error: unknown) {
    throw new Error(getErrorMessage(error, 'Erro ao gerar relatório'));
  }  
}

/**
 * Lista de tipos de relatórios disponíveis
 */
export const TIPOS_RELATORIOS = Object.keys(RELATORIOS);

/**
 * Obter configuração de um relatório
 * @param tipoRelatorio - Tipo de relatório
 * @returns Configuração do relatório ou null se não encontrado
 */
export function obterConfigRelatorio(tipoRelatorio: string): RelatorioConfig | null {
  return RELATORIOS[tipoRelatorio] || null;
}

/**
 * Validar se um tipo de relatório é válido
 * @param tipoRelatorio - Tipo de relatório a validar
 * @returns true se o tipo é válido, false caso contrário
 */
export function ehRelatorioValido(tipoRelatorio: string): boolean {
  return tipoRelatorio in RELATORIOS;
}

/**
 * Obter nome amigável do relatório
 * @param tipoRelatorio - Tipo de relatório
 * @returns Nome amigável ou tipo do relatório se não encontrado
 */
export function obterNomeRelatorio(tipoRelatorio: string): string {
  const nomes: Record<string, string> = {
    'receitas-pagas': 'Relatório de Receitas Pagas',
    'cliente-especifico': 'Relatório de Cliente Específico',
    'funcionario-especifico': 'Relatório de Funcionário/Fornecedor',
    'despesas-pagas': 'Relatório de Despesas Pagas',
    'despesas-a-pagar': 'Relatório de Despesas a Pagar',
    'receitas-a-receber': 'Relatório de Receitas a Receber',
    'dre-consolidado': 'Demonstração de Resultado do Exercício (DRE)',
    'fluxo-de-caixa': 'Relatório de Fluxo de Caixa',
    'recibo-pagamento': 'Recibo de Pagamento',
  };

  return nomes[tipoRelatorio] || tipoRelatorio;
}
