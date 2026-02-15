'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import DialogBase from './DialogBase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Select as AntdSelect } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrencyBR, formatCurrencyInput, parseCurrencyBR, formatDateBR } from '@/lib/formatters';
import { createAllocation, getAllocations, deleteAllocation } from '@/services/allocations';
import { getReceitasAbertas, getReceitaById } from '@/services/receitas';
import { getDespesasAbertas, getDespesaById } from '@/services/despesas';
import { getCustodiasAbertas, getCustodiaById } from '@/services/custodias';
import { transfersService } from '@/services/transfers';
import { LancamentoPendente } from '@/services/relatorios';
import { Receita } from '@/types/receitas';
import { Despesa } from '@/types/despesas';
import { Custodia } from '@/types/custodias';
import { Transfer } from '@/types/transfer';

// Tipo para uma alocação no formulário
interface AllocationForm {
  id: string; // ID temporário para gerenciar a lista
  allocation_id?: number; // ID da allocation no backend (se já existe)
  tipo: 'receita' | 'despesa' | 'custodia' | 'transfer';
  entidade_id: number;
  valor: number;
  valorDisplay: string;
  isExisting?: boolean; // Flag para indicar se é uma alocação existente
  isDeleted?: boolean; // Flag para indicar que esta alocação existente deve ser deletada
}

interface Props {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoPendente | null;
  onSuccess?: () => void;
}

export default function VincularLancamentoDialog({
  open,
  onClose,
  lancamento,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);

  // Lista de alocações
  const [allocations, setAllocations] = useState<AllocationForm[]>([]);

  // Listas de entidades para vincular
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [custodias, setCustodias] = useState<Custodia[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const loadExistingAllocations = useCallback(async () => {
    if (!lancamento) return;

    try {
      setLoading(true);

      // Buscar alocações do payment
      const res = await getAllocations({ payment_id: lancamento.id, page_size: 9999 });

      if (res.results.length > 0) {
        // Carregar dados completos das entidades vinculadas
        const receitasVinculadas: Receita[] = [];
        const despesasVinculadas: Despesa[] = [];
        const custodiasVinculadas: Custodia[] = [];
        const transfersVinculadas: Transfer[] = [];

        for (const alloc of res.results) {
          try {
            if (alloc.receita) {
              const receita = await getReceitaById(alloc.receita);
              receitasVinculadas.push(receita);
            } else if (alloc.despesa) {
              const despesa = await getDespesaById(alloc.despesa);
              despesasVinculadas.push(despesa);
            } else if (alloc.custodia) {
              const custodia = await getCustodiaById(alloc.custodia);
              custodiasVinculadas.push(custodia);
            } else if (alloc.transfer) {
              const transfer = await transfersService.get(alloc.transfer);
              transfersVinculadas.push(transfer);
            }
          } catch (error) {
            console.error('Erro ao carregar entidade vinculada:', error);
          }
        }

        // Adicionar entidades vinculadas às listas (evitando duplicatas)
        setReceitas((prev) => {
          const novos = receitasVinculadas.filter(
            (r) => !prev.some((p) => p.id === r.id)
          );
          return [...prev, ...novos];
        });

        setDespesas((prev) => {
          const novos = despesasVinculadas.filter(
            (d) => !prev.some((p) => p.id === d.id)
          );
          return [...prev, ...novos];
        });

        setCustodias((prev) => {
          const novos = custodiasVinculadas.filter(
            (c) => !prev.some((p) => p.id === c.id)
          );
          return [...prev, ...novos];
        });

        setTransfers((prev) => {
          const novos = transfersVinculadas.filter(
            (t) => !prev.some((p) => p.id === t.id)
          );
          return [...prev, ...novos];
        });

        // Mapear alocações existentes
        const existingAllocations: AllocationForm[] = res.results.map((alloc) => {
          let tipo: 'receita' | 'despesa' | 'custodia' | 'transfer' = 'receita';
          let entidade_id = 0;

          if (alloc.receita) {
            tipo = 'receita';
            entidade_id = alloc.receita;
          } else if (alloc.despesa) {
            tipo = 'despesa';
            entidade_id = alloc.despesa;
          } else if (alloc.custodia) {
            tipo = 'custodia';
            entidade_id = alloc.custodia;
          } else if (alloc.transfer) {
            tipo = 'transfer';
            entidade_id = alloc.transfer;
          }

          return {
            id: `existing-${alloc.id}`,
            allocation_id: alloc.id,
            tipo,
            entidade_id,
            valor: Number(alloc.valor) || 0,
            valorDisplay: formatCurrencyInput(Number(alloc.valor) || 0),
            isExisting: true,
          };
        });

        setAllocations(existingAllocations);
      } else {
        // Se não há alocações existentes, adicionar uma nova vazia
        const tipoDefault = lancamento.tipo === 'Entrada' ? 'receita' : 'despesa';
        const valorRestante = Number(lancamento.valor_nao_vinculado) || Number(lancamento.valor) || 0;

        setAllocations([
          {
            id: Date.now().toString(),
            tipo: tipoDefault,
            entidade_id: 0,
            valor: valorRestante,
            valorDisplay: formatCurrencyInput(valorRestante),
            isExisting: false,
          },
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar alocações existentes:', error);
      toast.error('Erro ao carregar alocações existentes');

      // Em caso de erro, adicionar uma alocação vazia
      const tipoDefault = lancamento.tipo === 'Entrada' ? 'receita' : 'despesa';
      const valorRestante = Number(lancamento.valor_nao_vinculado) || Number(lancamento.valor) || 0;

      setAllocations([
        {
          id: Date.now().toString(),
          tipo: tipoDefault,
          entidade_id: 0,
          valor: valorRestante,
          valorDisplay: formatCurrencyInput(valorRestante),
          isExisting: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [lancamento]);

  // Reset quando o diálogo abrir/fechar
  useEffect(() => {
    if (open && lancamento) {
      // Carregar entidades
      loadReceitas();
      loadDespesas();
      loadCustodias();
      loadTransfers();

      // Carregar alocações existentes
      loadExistingAllocations();
    } else {
      setAllocations([]);
    }
  }, [open, lancamento, loadExistingAllocations]);

  const loadReceitas = async () => {
    try {
      const res = await getReceitasAbertas({ page_size: 9999 });
      setReceitas(res.results);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
    }
  };

  const loadDespesas = async () => {
    try {
      const res = await getDespesasAbertas({ page_size: 9999 });
      setDespesas(res.results);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    }
  };

  const loadCustodias = async () => {
    try {
      const res = await getCustodiasAbertas({ page_size: 9999 });
      setCustodias(res.results);
    } catch (error) {
      console.error('Erro ao carregar custódias:', error);
    }
  };

  const loadTransfers = async () => {
    try {
      const res = await transfersService.list({ page_size: 9999 });
      // Filtrar transferências com status "Completo" (C)
      const transfersFiltered = res.results.filter(t => t.status !== 'C');
      setTransfers(transfersFiltered);
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
    }
  };

  // Função para recarregar todas as listas de entidades
  const reloadAllEntities = async () => {
    await Promise.all([
      loadReceitas(),
      loadDespesas(),
      loadCustodias(),
      loadTransfers(),
    ]);
  };

  // ======================
  // 🔹 ALLOCATION MANAGEMENT
  // ======================
  const addAllocation = () => {
    if (!lancamento) return;

    // Define o tipo padrão baseado no tipo de lançamento
    const tipoDefault = lancamento.tipo === 'Entrada' ? 'receita' : 'despesa';

    setAllocations([
      ...allocations,
      {
        id: Date.now().toString(),
        tipo: tipoDefault,
        entidade_id: 0,
        valor: 0,
        valorDisplay: '',
      },
    ]);
  };

  const removeAllocation = (id: string) => {
    const allocation = allocations.find((a) => a.id === id);

    if (allocation?.isExisting && allocation.allocation_id) {
      // Se é uma alocação existente, apenas marcar como deletada
      setAllocations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isDeleted: true } : a))
      );
    } else {
      // Se é uma nova alocação, remover da lista local
      setAllocations(allocations.filter((a) => a.id !== id));
    }
  };

  const updateAllocation = (id: string, field: keyof AllocationForm, value: string | number) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // ======================
  // 💾 SUBMIT
  // ======================
  const handleSubmit = async () => {
    if (!lancamento) {
      toast.error('Lançamento não encontrado');
      return;
    }

    // Filtrar alocações não deletadas
    const activeAllocations = allocations.filter((a) => !a.isDeleted);

    // Filtrar apenas as novas alocações (não existentes e não deletadas)
    const newAllocations = activeAllocations.filter(
      (a) => !a.isExisting && a.entidade_id > 0 && a.valor > 0
    );

    // Filtrar alocações existentes que foram marcadas para deletar
    const allocationsToDelete = allocations.filter(
      (a) => a.isExisting && a.isDeleted && a.allocation_id
    );

    // Verificar se há pelo menos uma alocação ativa válida
    const allValidAllocations = activeAllocations.filter(
      (a) => a.entidade_id > 0 && a.valor > 0
    );

    if (allValidAllocations.length === 0) {
      toast.error('Adicione pelo menos uma alocação válida');
      return;
    }

    // Verificar se a soma das alocações não excede o valor do lançamento
    const totalAlocado = allValidAllocations.reduce((sum, a) => sum + a.valor, 0);
    if (totalAlocado > lancamento.valor + 0.01) {
      toast.error(
        `A soma das alocações (${formatCurrencyBR(totalAlocado)}) excede o valor do lançamento (${formatCurrencyBR(lancamento.valor)})`
      );
      return;
    }

    // Se não há mudanças (sem novas alocações e sem deleções), apenas fechar
    if (newAllocations.length === 0 && allocationsToDelete.length === 0) {
      toast.info('Nenhuma alteração para salvar');
      onSuccess?.();
      onClose();
      return;
    }

    try {
      setLoading(true);

      // Primeiro, deletar as alocações marcadas
      for (const alloc of allocationsToDelete) {
        if (alloc.allocation_id) {
          await deleteAllocation(alloc.allocation_id);
        }
      }

      // Depois, criar as novas alocações
      for (const alloc of newAllocations) {
        const allocationPayload: {
          payment_id: number;
          valor: number;
          receita_id?: number;
          despesa_id?: number;
          custodia_id?: number;
          transfer_id?: number;
        } = {
          payment_id: lancamento.id,
          valor: alloc.valor,
        };

        if (alloc.tipo === 'receita') {
          allocationPayload.receita_id = alloc.entidade_id;
        } else if (alloc.tipo === 'despesa') {
          allocationPayload.despesa_id = alloc.entidade_id;
        } else if (alloc.tipo === 'custodia') {
          allocationPayload.custodia_id = alloc.entidade_id;
        } else if (alloc.tipo === 'transfer') {
          allocationPayload.transfer_id = alloc.entidade_id;
        }

        await createAllocation(allocationPayload);
      }

      // Mensagem de sucesso
      const messages = [];
      if (allocationsToDelete.length > 0) {
        messages.push(
          `${allocationsToDelete.length} ${allocationsToDelete.length === 1 ? 'alocação removida' : 'alocações removidas'}`
        );
      }
      if (newAllocations.length > 0) {
        messages.push(
          `${newAllocations.length} ${newAllocations.length === 1 ? 'alocação criada' : 'alocações criadas'}`
        );
      }

      toast.success(messages.join(' e ') + ' com sucesso');

      // Recarregar as listas de entidades para garantir que apenas itens em aberto apareçam
      await reloadAllEntities();

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao vincular lançamento:', error);
      toast.error('Erro ao processar alocações');
    } finally {
      setLoading(false);
    }
  };

  if (!lancamento) return null;

  // Calcular valor total alocado e valor restante
  // Filtrar apenas alocações não deletadas
  const activeAllocations = allocations.filter((a) => !a.isDeleted);

  // Separar alocações existentes e novas (ambas não deletadas)
  const alocacoesExistentes = activeAllocations.filter((a) => a.isExisting);
  const alocacoesNovas = activeAllocations.filter((a) => !a.isExisting);

  const totalAlocadoExistente = alocacoesExistentes.reduce((sum, a) => sum + (a.valor || 0), 0);
  const totalAlocadoNovo = alocacoesNovas.reduce((sum, a) => sum + (a.valor || 0), 0);
  const totalAlocado = totalAlocadoExistente + totalAlocadoNovo;
  const valorRestante = lancamento.valor - totalAlocado;

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title="Vincular Lançamento"
      onSubmit={handleSubmit}
      size="lg"
      loading={loading}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Informações do lançamento */}
        <div className="bg-muted p-4 rounded-md">
          <h3 className="text-sm font-medium mb-3">Informações do Lançamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Tipo:</span>
              <div className="font-medium mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs ${
                    lancamento.tipo === 'Entrada'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {lancamento.tipo}
                </span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>
              <div className="font-medium mt-1">{lancamento.data}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Valor Total:</span>
              <div
                className={`font-bold mt-1 ${
                  lancamento.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrencyBR(lancamento.valor)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Conta:</span>
              <div className="font-medium mt-1 truncate" title={lancamento.conta_bancaria}>
                {lancamento.conta_bancaria}
              </div>
            </div>
            {lancamento.observacao && (
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground">Observação:</span>
                <div className="font-medium mt-1 text-xs">{lancamento.observacao}</div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo de Alocação */}
        {activeAllocations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-muted-foreground">Total Alocado:</span>
                  <span className="font-bold ml-2 text-blue-700">
                    {formatCurrencyBR(totalAlocado)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Restante:</span>
                  <span
                    className={`font-bold ml-2 ${
                      valorRestante < -0.01
                        ? 'text-red-600'
                        : valorRestante > 0.01
                        ? 'text-orange-600'
                        : 'text-green-600'
                    }`}
                  >
                    {formatCurrencyBR(valorRestante)}
                  </span>
                </div>
              </div>
              {alocacoesExistentes.length > 0 && alocacoesNovas.length > 0 && (
                <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-2">
                  <div>
                    Existentes: {formatCurrencyBR(totalAlocadoExistente)}
                  </div>
                  <div>
                    Novas: {formatCurrencyBR(totalAlocadoNovo)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alocações */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Alocações</h3>
              <p className="text-xs text-muted-foreground">
                Vincule este lançamento a receitas, despesas ou custódias
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAllocation}
            >
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Lista de Alocações */}
          <div className="space-y-2">
            {activeAllocations.map((alloc, index) => (
              <div
                key={alloc.id}
                className={`grid grid-cols-12 gap-2 items-end p-2 rounded ${
                  alloc.isExisting ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                {/* Tipo */}
                <div className="col-span-3">
                  <label className="text-xs font-medium block mb-1">
                    Tipo {index === 0 && '*'}
                    {alloc.isExisting && (
                      <span className="ml-1 text-blue-600 text-xs">(Existente)</span>
                    )}
                  </label>
                  <Select
                    value={alloc.tipo}
                    onValueChange={(val) => {
                      setAllocations((prev) =>
                        prev.map((a) =>
                          a.id === alloc.id
                            ? { ...a, tipo: val as 'receita' | 'despesa' | 'custodia', entidade_id: 0 }
                            : a
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lancamento.tipo === 'Entrada' && (
                        <SelectItem value="receita">Receita</SelectItem>
                      )}
                      {lancamento.tipo === 'Saída' && (
                        <SelectItem value="despesa">Despesa</SelectItem>
                      )}
                      <SelectItem value="custodia">Custódia</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Entidade */}
                <div className="col-span-5">
                  <label className="text-xs font-medium block mb-1">
                    {alloc.tipo === 'receita'
                      ? 'Receita'
                      : alloc.tipo === 'despesa'
                      ? 'Despesa'
                      : alloc.tipo === 'custodia'
                      ? 'Custódia'
                      : 'Transferência'}{' '}
                    {index === 0 && '*'}
                  </label>
                  <AntdSelect
                    key={`entidade-${alloc.id}-${alloc.tipo}`}
                    showSearch
                    placeholder={`Selecione ${
                      alloc.tipo === 'receita'
                        ? 'uma receita'
                        : alloc.tipo === 'despesa'
                        ? 'uma despesa'
                        : alloc.tipo === 'custodia'
                        ? 'uma custódia'
                        : 'uma transferência'
                    }`}
                    value={alloc.entidade_id || undefined}
                    options={
                      alloc.tipo === 'receita'
                        ? receitas.map((r) => ({
                            value: r.id,
                            label: `${r.nome} - ${r.cliente?.nome || 'Sem cliente'} - ${formatCurrencyBR(r.valor_aberto ?? r.valor)}`,
                          }))
                        : alloc.tipo === 'despesa'
                        ? despesas.map((d) => ({
                            value: d.id,
                            label: `${d.nome} - ${d.responsavel?.nome || 'Sem responsável'} - ${formatCurrencyBR(d.valor_aberto ?? d.valor)}`,
                          }))
                        : alloc.tipo === 'custodia'
                        ? custodias.map((c) => ({
                            value: c.id,
                            label: `${c.nome} - ${c.cliente?.nome || c.cliente_nome || c.funcionario?.nome || c.funcionario_nome || '-'} - ${formatCurrencyBR(c.valor_aberto ?? (c.valor_total - c.valor_liquidado))}`,
                          }))
                        : transfers.map((t) => ({
                            value: t.id,
                            label: `${t.from_bank_nome} → ${t.to_bank_nome} - ${formatCurrencyBR(parseFloat(t.valor))} - ${formatDateBR(t.data_transferencia)}`,
                          }))
                    }
                    onChange={(val) => {
                      updateAllocation(alloc.id, 'entidade_id', val);

                      // Preencher automaticamente o valor em aberto da entidade selecionada
                      let valorAberto = 0;

                      if (alloc.tipo === 'receita') {
                        const receita = receitas.find((r) => r.id === val);
                        if (receita) {
                          valorAberto = receita.valor_aberto ?? receita.valor;
                        }
                      } else if (alloc.tipo === 'despesa') {
                        const despesa = despesas.find((d) => d.id === val);
                        if (despesa) {
                          valorAberto = despesa.valor_aberto ?? despesa.valor;
                        }
                      } else if (alloc.tipo === 'custodia') {
                        const custodia = custodias.find((c) => c.id === val);
                        if (custodia) {
                          valorAberto = custodia.valor_aberto ?? (custodia.valor_total - custodia.valor_liquidado);
                        }
                      } else if (alloc.tipo === 'transfer') {
                        const transfer = transfers.find((t) => t.id === val);
                        if (transfer) {
                          // Para transferências, usar o valor da transferência menos o que já foi alocado
                          const valorTransfer = parseFloat(transfer.valor);
                          const valorSaida = parseFloat(transfer.valor_saida);
                          const valorEntrada = parseFloat(transfer.valor_entrada);

                          // Se for saída, usar valor - valor_saida, se for entrada, usar valor - valor_entrada
                          if (lancamento.tipo === 'Saída') {
                            valorAberto = Math.max(0, valorTransfer - valorSaida);
                          } else {
                            valorAberto = Math.max(0, valorTransfer - valorEntrada);
                          }
                        }
                      }

                      // Preenche o valor automaticamente
                      if (valorAberto > 0) {
                        updateAllocation(alloc.id, 'valorDisplay', formatCurrencyInput(valorAberto));
                        updateAllocation(alloc.id, 'valor', valorAberto);
                      }
                    }}
                    className="h-9 [&_.ant-select-selector]:!h-9 [&_.ant-select-selector]:!py-0 [&_.ant-select-selection-search]:!h-9 [&_.ant-select-selection-item]:!leading-9"
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </div>

                {/* Valor */}
                <div className="col-span-3">
                  <label className="text-xs font-medium block mb-1">
                    Valor (R$) {index === 0 && '*'}
                  </label>
                  <Input
                    placeholder="0,00"
                    value={alloc.valorDisplay}
                    onChange={(e) =>
                      updateAllocation(alloc.id, 'valorDisplay', e.target.value)
                    }
                    onBlur={() => {
                      const isLastAllocation = activeAllocations[activeAllocations.length - 1].id === alloc.id;
                      const isBlankValue = !alloc.valorDisplay || alloc.valorDisplay.trim() === '';

                      // Se for a última alocação e o valor estiver em branco, calcular o restante
                      if (isLastAllocation && isBlankValue && activeAllocations.length > 0 && lancamento) {
                        const totalAllocated = activeAllocations.reduce((sum, a) => {
                          if (a.id === alloc.id) return sum; // Ignora a última alocação
                          return sum + (a.valor || 0);
                        }, 0);

                        const remaining = lancamento.valor - totalAllocated;

                        if (remaining > 0) {
                          updateAllocation(alloc.id, 'valorDisplay', formatCurrencyInput(remaining));
                          updateAllocation(alloc.id, 'valor', remaining);
                          return;
                        }
                      }

                      // Caso contrário, comportamento normal
                      const parsed = parseCurrencyBR(alloc.valorDisplay);
                      updateAllocation(
                        alloc.id,
                        'valorDisplay',
                        parsed ? formatCurrencyInput(parsed) : ''
                      );
                      updateAllocation(alloc.id, 'valor', parsed);
                    }}
                    className="h-9"
                  />
                </div>

                {/* Delete Button */}
                <div className="col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAllocation(alloc.id)}
                    className="h-9 w-9 p-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dicas */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          <p className="font-medium mb-1">Dicas:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Você pode vincular o lançamento a múltiplas entidades</li>
            <li>O valor é preenchido automaticamente com o valor em aberto da entidade</li>
            <li>
              Se deixar o valor da última alocação em branco, o sistema calculará o valor restante
              automaticamente
            </li>
            <li>
              {lancamento.tipo === 'Entrada'
                ? 'Entradas podem ser vinculadas a Receitas, Custódias ou Transferências'
                : 'Saídas podem ser vinculadas a Despesas, Custódias ou Transferências'}
            </li>
          </ul>
        </div>
      </div>
    </DialogBase>
  );
}
