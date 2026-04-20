'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button as ShadcnButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Coins,
  Users,
  Receipt,
  Percent,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Pencil,
  Save,
  X,
  Plus,
} from 'lucide-react';
import {
  getRelatorioComissoes,
  ComissoesRelatorioData,
  ComissionadoDetalhe,
  ComissaoPagamento,
} from '@/services/relatorios';
import { getFuncionarios } from '@/services/funcionarios';
import { gerarComissoes, updateCliente, getClientes } from '@/services/clientes';
import { updateReceita, getReceitaById, getReceitas } from '@/services/receitas';
import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';
import { Receita } from '@/types/receitas';
import { formatCurrencyBR, formatDateBR } from '@/lib/formatters';
import { gerarRelatorioPDF } from '@/services/pdf';
import { getErrorMessage } from '@/lib/errors';
import { useUpgradeGuard } from '@/hooks/useUpgradeGuard';
import { UpgradeDialog } from '@/components/UpgradeDialog';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export default function ComissoesPage() {
  const { guard, isUpgradeDialogOpen, closeUpgradeDialog, blockedFeatureLabel } =
    useUpgradeGuard();

  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [funcionarioId, setFuncionarioId] = useState<string>('todos');

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [data, setData] = useState<ComissoesRelatorioData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});

  const [editandoKey, setEditandoKey] = useState<string | null>(null);
  const [percentualEdit, setPercentualEdit] = useState<string>('');
  const [salvandoRegra, setSalvandoRegra] = useState(false);

  const [modoNovaComissao, setModoNovaComissao] = useState(false);
  const [novaComissao, setNovaComissao] = useState<{
    funcionario_id: number | null;
    escopo: 'cliente' | 'receita';
    cliente_id: number | null;
    receita_id: number | null;
    percentual: string;
  }>({
    funcionario_id: null,
    escopo: 'cliente',
    cliente_id: null,
    receita_id: null,
    percentual: '',
  });
  const [receitasDoCliente, setReceitasDoCliente] = useState<Receita[]>([]);
  const [loadingReceitas, setLoadingReceitas] = useState(false);

  const comissionadoSelecionado = funcionarioId !== 'todos';

  const carregarAuxiliares = useCallback(async () => {
    try {
      const [funcs, cls] = await Promise.all([
        getFuncionarios({ page: 1, page_size: 1000 }),
        getClientes({ page: 1, page_size: 1000 }),
      ]);
      setFuncionarios(
        funcs.results.filter((f) => f.tipo === 'F' || f.tipo === 'P')
      );
      setClientes(cls.results);
    } catch (error) {
      console.error('Erro ao carregar dados auxiliares:', error);
    }
  }, []);

  const recarregarClientes = useCallback(async () => {
    try {
      const cls = await getClientes({ page: 1, page_size: 1000 });
      setClientes(cls.results);
    } catch (error) {
      console.error('Erro ao recarregar clientes:', error);
    }
  }, []);

  const carregarRelatorio = useCallback(async () => {
    try {
      setLoading(true);
      const funcId =
        funcionarioId !== 'todos' ? Number(funcionarioId) : undefined;
      const response = await getRelatorioComissoes(mes, ano, funcId);
      setData(response);
    } catch (error) {
      console.error('Erro ao carregar relatório de comissões:', error);
      toast.error(getErrorMessage(error, 'Erro ao carregar comissões'));
    } finally {
      setLoading(false);
    }
  }, [mes, ano, funcionarioId]);

  useEffect(() => {
    carregarAuxiliares();
  }, [carregarAuxiliares]);

  useEffect(() => {
    carregarRelatorio();
  }, [carregarRelatorio]);

  const handleGerarPDF = async () => {
    try {
      setLoadingPDF(true);
      const payload: { mes: number; ano: number; funcionario_id?: number } = {
        mes,
        ano,
      };
      if (funcionarioId !== 'todos')
        payload.funcionario_id = Number(funcionarioId);
      await gerarRelatorioPDF('comissionamento', payload);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erro ao gerar relatório'));
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleRegenerar = async () => {
    try {
      setRegenerando(true);
      const res = await gerarComissoes(mes, ano);
      const qtd = res.comissionados?.length ?? 0;
      if (qtd === 0) {
        toast.info(
          `Nenhuma comissão gerada para ${String(mes).padStart(2, '0')}/${ano}`
        );
      } else {
        toast.success(
          `Comissões regeneradas: ${qtd} comissionado(s), total ${formatCurrencyBR(res.total)}`
        );
      }
      await carregarRelatorio();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erro ao regenerar comissões'));
    } finally {
      setRegenerando(false);
    }
  };

  const toggleExpandido = (id: number) => {
    setExpandido((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /* ========== EDIÇÃO INLINE DO PERCENTUAL ========== */

  const chavePagamento = (p: ComissaoPagamento, funcId: number) =>
    `${funcId}-${p.allocation_id}-${p.origem_regra}`;

  const iniciarEdicao = (p: ComissaoPagamento, funcId: number) => {
    setEditandoKey(chavePagamento(p, funcId));
    setPercentualEdit(String(p.percentual));
  };

  const cancelarEdicao = () => {
    setEditandoKey(null);
    setPercentualEdit('');
  };

  const salvarPercentual = async (
    p: ComissaoPagamento,
    funcId: number
  ) => {
    const valor = Number(percentualEdit.replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
      toast.error('Percentual inválido (0 a 100)');
      return;
    }

    try {
      setSalvandoRegra(true);

      if (p.origem_regra === 'receita') {
        const receita = await getReceitaById(p.receita_id);
        const comissoesAtualizadas = (receita.comissoes ?? []).map((c) =>
          c.funcionario_id === funcId
            ? { funcionario_id: c.funcionario_id, percentual: valor }
            : {
                funcionario_id: c.funcionario_id,
                percentual: Number(c.percentual),
              }
        );
        await updateReceita(p.receita_id, { comissoes: comissoesAtualizadas });
        toast.success('Comissão da receita atualizada');
      } else {
        const cliente = clientes.find((c) => c.id === p.cliente_id);
        if (!cliente) throw new Error('Cliente não encontrado');

        const comissoesAtualizadas = (cliente.comissoes ?? []).map((c) =>
          c.funcionario_id === funcId
            ? { funcionario_id: c.funcionario_id, percentual: valor }
            : {
                funcionario_id: c.funcionario_id,
                percentual: Number(c.percentual),
              }
        );
        await updateCliente(p.cliente_id, { comissoes: comissoesAtualizadas });
        toast.success('Comissão do cliente atualizada');
        await recarregarClientes();
      }

      cancelarEdicao();
      await carregarRelatorio();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erro ao salvar comissão'));
    } finally {
      setSalvandoRegra(false);
    }
  };

  /* ========== NOVA COMISSÃO ========== */

  const abrirNovaComissao = () => {
    setModoNovaComissao(true);
    setNovaComissao({
      funcionario_id:
        funcionarioId !== 'todos' ? Number(funcionarioId) : null,
      escopo: 'cliente',
      cliente_id: null,
      receita_id: null,
      percentual: '',
    });
    setReceitasDoCliente([]);
  };

  const fecharNovaComissao = () => {
    setModoNovaComissao(false);
    setNovaComissao({
      funcionario_id: null,
      escopo: 'cliente',
      cliente_id: null,
      receita_id: null,
      percentual: '',
    });
    setReceitasDoCliente([]);
  };

  const onChangeClienteNovaComissao = async (clienteId: number) => {
    setNovaComissao((p) => ({ ...p, cliente_id: clienteId, receita_id: null }));
    if (novaComissao.escopo === 'receita') {
      try {
        setLoadingReceitas(true);
        const res = await getReceitas({ page: 1, page_size: 500 });
        setReceitasDoCliente(
          res.results.filter((r) => r.cliente?.id === clienteId)
        );
      } catch (error) {
        console.error('Erro ao carregar receitas:', error);
        setReceitasDoCliente([]);
      } finally {
        setLoadingReceitas(false);
      }
    }
  };

  const onChangeEscopoNovaComissao = async (escopo: 'cliente' | 'receita') => {
    setNovaComissao((p) => ({ ...p, escopo, receita_id: null }));
    if (escopo === 'receita' && novaComissao.cliente_id) {
      try {
        setLoadingReceitas(true);
        const res = await getReceitas({ page: 1, page_size: 500 });
        setReceitasDoCliente(
          res.results.filter((r) => r.cliente?.id === novaComissao.cliente_id)
        );
      } catch (error) {
        console.error('Erro ao carregar receitas:', error);
        setReceitasDoCliente([]);
      } finally {
        setLoadingReceitas(false);
      }
    } else {
      setReceitasDoCliente([]);
    }
  };

  const criarNovaComissao = async () => {
    const { funcionario_id, escopo, cliente_id, receita_id, percentual } =
      novaComissao;

    if (!funcionario_id) {
      toast.error('Selecione o comissionado');
      return;
    }
    if (!cliente_id) {
      toast.error('Selecione o cliente');
      return;
    }
    if (escopo === 'receita' && !receita_id) {
      toast.error('Selecione a receita');
      return;
    }
    const valor = Number(String(percentual).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0 || valor > 100) {
      toast.error('Percentual inválido (0 a 100)');
      return;
    }

    try {
      setSalvandoRegra(true);

      if (escopo === 'cliente') {
        const cliente = clientes.find((c) => c.id === cliente_id);
        if (!cliente) throw new Error('Cliente não encontrado');
        if (
          (cliente.comissoes ?? []).some(
            (c) => c.funcionario_id === funcionario_id
          )
        ) {
          toast.error(
            'Esse comissionado já possui regra para este cliente. Edite a existente.'
          );
          return;
        }
        const comissoesAtualizadas = [
          ...(cliente.comissoes ?? []).map((c) => ({
            funcionario_id: c.funcionario_id,
            percentual: Number(c.percentual),
          })),
          { funcionario_id, percentual: valor },
        ];
        await updateCliente(cliente_id, { comissoes: comissoesAtualizadas });
        toast.success('Comissão adicionada ao cliente');
        await recarregarClientes();
      } else {
        const receita = await getReceitaById(receita_id!);
        if (
          (receita.comissoes ?? []).some(
            (c) => c.funcionario_id === funcionario_id
          )
        ) {
          toast.error(
            'Essa receita já tem uma comissão para este comissionado. Edite a existente.'
          );
          return;
        }
        const comissoesAtualizadas = [
          ...(receita.comissoes ?? []).map((c) => ({
            funcionario_id: c.funcionario_id,
            percentual: Number(c.percentual),
          })),
          { funcionario_id, percentual: valor },
        ];
        await updateReceita(receita_id!, { comissoes: comissoesAtualizadas });
        toast.success('Comissão adicionada à receita');
      }

      fecharNovaComissao();
      await carregarRelatorio();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erro ao adicionar comissão'));
    } finally {
      setSalvandoRegra(false);
    }
  };

  /* ========== RENDER ========== */

  const comissionados = data?.comissionados ?? [];

  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="space-y-6">
          {/* HEADER */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Coins className="h-6 w-6" />
                Central de Comissões
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Visualize e gerencie as comissões de funcionários e parceiros —{' '}
                {String(mes).padStart(2, '0')}/{ano}
              </p>
            </div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={guard('pdf_export', handleGerarPDF)}
              loading={loadingPDF}
              className="shadow-md whitespace-nowrap"
            >
              Gerar Relatório PDF
            </Button>
          </div>

          <UpgradeDialog
            open={isUpgradeDialogOpen}
            onClose={closeUpgradeDialog}
            feature={blockedFeatureLabel}
          />

          {/* FILTROS */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Mês</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-white"
              >
                {MESES.map((nome, i) => (
                  <option key={i} value={i + 1}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted-foreground">Ano</label>
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="border rounded-md px-3 py-2 text-sm bg-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[240px]">
              <label className="text-sm text-muted-foreground">
                Comissionado
              </label>
              <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.nome} ({f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ShadcnButton
              variant="outline"
              onClick={handleRegenerar}
              disabled={regenerando || loading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${regenerando ? 'animate-spin' : ''}`}
              />
              {regenerando ? 'Regenerando...' : 'Regenerar Comissões do Mês'}
            </ShadcnButton>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <span className="text-sm text-muted-foreground">
                Carregando comissões...
              </span>
            </div>
          ) : data ? (
            <>
              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total de Comissões
                    </CardTitle>
                    <Coins className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrencyBR(data.resumo.total_comissao)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      no período selecionado
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Comissionados
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {data.resumo.total_comissionados}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      pessoas com comissão
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Pagamentos
                    </CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {data.resumo.total_pagamentos}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      alocações computadas
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Percentual Médio
                    </CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {data.resumo.percentual_medio.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ponderado por alocação
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* COMISSÕES POR PESSOA */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Comissões por Pessoa</CardTitle>
                  {!modoNovaComissao && (
                    <ShadcnButton
                      size="sm"
                      onClick={abrirNovaComissao}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Nova comissão
                    </ShadcnButton>
                  )}
                </CardHeader>
                <CardContent>
                  {modoNovaComissao && (
                    <div className="border rounded-md p-4 mb-4 bg-muted/40 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4 space-y-1">
                          <label className="text-xs font-medium">
                            Comissionado
                          </label>
                          <Select
                            value={
                              novaComissao.funcionario_id
                                ? String(novaComissao.funcionario_id)
                                : undefined
                            }
                            onValueChange={(v) =>
                              setNovaComissao((p) => ({
                                ...p,
                                funcionario_id: Number(v),
                              }))
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {funcionarios.map((f) => (
                                <SelectItem key={f.id} value={f.id.toString()}>
                                  {f.nome} (
                                  {f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <label className="text-xs font-medium">Escopo</label>
                          <Select
                            value={novaComissao.escopo}
                            onValueChange={(v) =>
                              onChangeEscopoNovaComissao(
                                v as 'cliente' | 'receita'
                              )
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cliente">
                                Cliente (todas receitas)
                              </SelectItem>
                              <SelectItem value="receita">
                                Receita específica
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <label className="text-xs font-medium">Cliente</label>
                          <Select
                            value={
                              novaComissao.cliente_id
                                ? String(novaComissao.cliente_id)
                                : undefined
                            }
                            onValueChange={(v) =>
                              onChangeClienteNovaComissao(Number(v))
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clientes.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  {c.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium">
                            % Comissão
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Ex: 15"
                            value={novaComissao.percentual}
                            onChange={(e) =>
                              setNovaComissao((p) => ({
                                ...p,
                                percentual: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {novaComissao.escopo === 'receita' && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Receita</label>
                          <Select
                            value={
                              novaComissao.receita_id
                                ? String(novaComissao.receita_id)
                                : undefined
                            }
                            onValueChange={(v) =>
                              setNovaComissao((p) => ({
                                ...p,
                                receita_id: Number(v),
                              }))
                            }
                            disabled={
                              !novaComissao.cliente_id || loadingReceitas
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue
                                placeholder={
                                  !novaComissao.cliente_id
                                    ? 'Selecione o cliente primeiro'
                                    : loadingReceitas
                                      ? 'Carregando...'
                                      : receitasDoCliente.length === 0
                                        ? 'Nenhuma receita para este cliente'
                                        : 'Selecione a receita...'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {receitasDoCliente.map((r) => (
                                <SelectItem key={r.id} value={r.id.toString()}>
                                  {r.nome} —{' '}
                                  {formatCurrencyBR(Number(r.valor))}
                                  {r.data_vencimento
                                    ? ` (venc. ${formatDateBR(r.data_vencimento)})`
                                    : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Regras de receita sobrescrevem as regras do cliente
                            apenas nessa receita.
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <ShadcnButton
                          variant="outline"
                          size="sm"
                          onClick={fecharNovaComissao}
                          disabled={salvandoRegra}
                        >
                          Cancelar
                        </ShadcnButton>
                        <ShadcnButton
                          size="sm"
                          onClick={criarNovaComissao}
                          disabled={salvandoRegra}
                        >
                          Adicionar
                        </ShadcnButton>
                      </div>
                    </div>
                  )}

                  {comissionados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma comissão calculada para o período selecionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {comissionados.map((c) => (
                        <ComissionadoRow
                          key={c.funcionario.id}
                          detalhe={c}
                          forceOpen={comissionadoSelecionado}
                          expandido={!!expandido[c.funcionario.id]}
                          onToggle={() => toggleExpandido(c.funcionario.id)}
                          editandoKey={editandoKey}
                          percentualEdit={percentualEdit}
                          salvandoRegra={salvandoRegra}
                          onIniciarEdicao={iniciarEdicao}
                          onCancelarEdicao={cancelarEdicao}
                          onSalvarPercentual={salvarPercentual}
                          onChangePercentual={setPercentualEdit}
                          chavePagamento={chavePagamento}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12">
              <span className="text-sm text-red-500">
                Erro ao carregar dados do relatório
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ============== LINHA DE COMISSIONADO ============== */

interface ComissionadoRowProps {
  detalhe: ComissionadoDetalhe;
  forceOpen: boolean;
  expandido: boolean;
  onToggle: () => void;
  editandoKey: string | null;
  percentualEdit: string;
  salvandoRegra: boolean;
  onIniciarEdicao: (p: ComissaoPagamento, funcId: number) => void;
  onCancelarEdicao: () => void;
  onSalvarPercentual: (p: ComissaoPagamento, funcId: number) => void;
  onChangePercentual: (v: string) => void;
  chavePagamento: (p: ComissaoPagamento, funcId: number) => string;
}

function ComissionadoRow({
  detalhe,
  forceOpen,
  expandido,
  onToggle,
  editandoKey,
  percentualEdit,
  salvandoRegra,
  onIniciarEdicao,
  onCancelarEdicao,
  onSalvarPercentual,
  onChangePercentual,
  chavePagamento,
}: ComissionadoRowProps) {
  const aberto = forceOpen || expandido;
  const tipoLabel =
    detalhe.funcionario.tipo === 'F' ? 'Funcionário' : 'Parceiro';

  return (
    <div className="border rounded-md">
      {forceOpen ? (
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="font-medium">{detalhe.funcionario.nome}</span>
            <Badge variant="secondary" className="text-xs">
              {tipoLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {detalhe.total_pagamentos} pagamento
              {detalhe.total_pagamentos !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="font-semibold text-green-600">
            {formatCurrencyBR(detalhe.total_comissao)}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandido ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{detalhe.funcionario.nome}</span>
            <Badge variant="secondary" className="text-xs">
              {tipoLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {detalhe.total_pagamentos} pagamento
              {detalhe.total_pagamentos !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="font-semibold text-green-600">
            {formatCurrencyBR(detalhe.total_comissao)}
          </span>
        </button>
      )}

      {aberto && (
        <div
          className={`${forceOpen ? '' : 'border-t'} px-4 py-3 bg-muted/20`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Cliente</th>
                  <th className="text-left py-2">Origem</th>
                  <th className="text-right py-2">Valor Pago</th>
                  <th className="text-right py-2">%</th>
                  <th className="text-right py-2">Comissão</th>
                  <th className="text-center py-2 w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.pagamentos.map((p, i) => {
                  const key = chavePagamento(p, detalhe.funcionario.id);
                  const emEdicao = editandoKey === key;
                  return (
                    <tr
                      key={`${p.allocation_id}-${i}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-2">{formatDateBR(p.data_pagamento)}</td>
                      <td className="py-2">{p.cliente_nome}</td>
                      <td className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            p.origem_regra === 'receita'
                              ? 'border-blue-300 text-blue-700'
                              : 'border-gray-300 text-gray-700'
                          }`}
                        >
                          {p.origem_regra === 'receita' ? 'Receita' : 'Cliente'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {formatCurrencyBR(p.valor_pagamento)}
                      </td>
                      <td className="py-2 text-right">
                        {emEdicao ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={percentualEdit}
                            onChange={(e) => onChangePercentual(e.target.value)}
                            className="w-20 ml-auto text-right h-8"
                          />
                        ) : (
                          `${Number(p.percentual).toFixed(2)}%`
                        )}
                      </td>
                      <td className="py-2 text-right font-medium text-green-700">
                        {formatCurrencyBR(p.valor_comissao)}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-center gap-1">
                          {emEdicao ? (
                            <>
                              <ShadcnButton
                                size="icon"
                                variant="outline"
                                onClick={() =>
                                  onSalvarPercentual(
                                    p,
                                    detalhe.funcionario.id
                                  )
                                }
                                disabled={salvandoRegra}
                                title="Salvar"
                                className="h-7 w-7"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </ShadcnButton>
                              <ShadcnButton
                                size="icon"
                                variant="ghost"
                                onClick={onCancelarEdicao}
                                disabled={salvandoRegra}
                                title="Cancelar"
                                className="h-7 w-7"
                              >
                                <X className="h-3.5 w-3.5" />
                              </ShadcnButton>
                            </>
                          ) : (
                            <ShadcnButton
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                onIniciarEdicao(p, detalhe.funcionario.id)
                              }
                              title={
                                p.origem_regra === 'receita'
                                  ? 'Editar % na receita'
                                  : 'Editar % no cliente'
                              }
                              className="h-7 w-7"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </ShadcnButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detalhe.pagamentos.some((p) => p.origem_regra === 'cliente') && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Regras com origem <strong>Cliente</strong> afetam todas as receitas
              daquele cliente. Regras com origem <strong>Receita</strong>{' '}
              substituem a regra do cliente apenas naquela receita.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
