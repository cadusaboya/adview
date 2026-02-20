'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { SortedSelect as AntdSelect } from '@/components/ui/SortedSelect';
import { Plus, Trash2 } from 'lucide-react';

import { formatCurrencyInput, parseCurrencyBR, formatDateBR } from '@/lib/formatters';

import { getBancos } from '@/services/bancos';
import { getReceitasAbertas } from '@/services/receitas';
import { getDespesasAbertas } from '@/services/despesas';
import { getCustodiasAbertas } from '@/services/custodias';
import { transfersService } from '@/services/transfers';

import { Banco } from '@/types/bancos';
import { Receita } from '@/types/receitas';
import { Despesa } from '@/types/despesas';
import { Custodia } from '@/types/custodias';
import { Transfer } from '@/types/transfer';
import { Payment, PaymentCreate } from '@/types/payments';

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
  onSubmit: (data: PaymentCreate & {
    allocations?: AllocationForm[];
    allocationsToDelete?: number[]; // IDs das alocações a deletar
  }) => Promise<void>;
  payment?: Payment | null;
}

export default function PaymentDialog({
  open,
  onClose,
  onSubmit,
  payment,
}: Props) {
  const [formData, setFormData] = useState<PaymentCreate>({
    tipo: 'E',
    conta_bancaria: 0,
    valor: 0,
    data_pagamento: '',
    observacao: '',
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [bancos, setBancos] = useState<Banco[]>([]);

  // Lista de alocações
  const [allocations, setAllocations] = useState<AllocationForm[]>([]);

  // Listas de entidades para vincular
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [custodias, setCustodias] = useState<Custodia[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // ======================
  // 🔄 LOAD EDIT
  // ======================
  useEffect(() => {
    if (payment) {
      setFormData({
        tipo: payment.tipo,
        conta_bancaria: payment.conta_bancaria,
        valor: payment.valor,
        data_pagamento: payment.data_pagamento,
        observacao: payment.observacao || '',
      });

      setValorDisplay(formatCurrencyInput(payment.valor));

      // Carrega alocações existentes para edição
      if (payment.allocations_info && payment.allocations_info.length > 0) {
        const loadedAllocations: AllocationForm[] = payment.allocations_info.map((alloc, index) => {
          let tipo: 'receita' | 'despesa' | 'custodia' | 'transfer' = 'receita';
          let entidade_id = 0;

          if (alloc.receita) {
            tipo = 'receita';
            entidade_id = alloc.receita.id;

            // Adicionar a receita à lista se não estiver presente
            const receitaInfo = {
              id: alloc.receita.id,
              nome: alloc.receita.nome,
              cliente: { nome: alloc.receita.cliente },
              valor: 0, // valor não importa aqui
              valor_aberto: 0,
            } as Receita;

            setReceitas(prev => {
              const exists = prev.some(r => r.id === receitaInfo.id);
              return exists ? prev : [...prev, receitaInfo];
            });
          } else if (alloc.despesa) {
            tipo = 'despesa';
            entidade_id = alloc.despesa.id;

            // Adicionar a despesa à lista se não estiver presente
            const despesaInfo = {
              id: alloc.despesa.id,
              nome: alloc.despesa.nome,
              responsavel: { nome: alloc.despesa.responsavel },
              valor: 0,
              valor_aberto: 0,
            } as Despesa;

            setDespesas(prev => {
              const exists = prev.some(d => d.id === despesaInfo.id);
              return exists ? prev : [...prev, despesaInfo];
            });
          } else if (alloc.custodia) {
            tipo = 'custodia';
            entidade_id = alloc.custodia.id;

            // Adicionar a custódia à lista se não estiver presente
            const custodiaInfo = {
              id: alloc.custodia.id,
              nome: alloc.custodia.nome,
              valor_total: 0,
              valor_liquidado: 0,
            } as Custodia;

            setCustodias(prev => {
              const exists = prev.some(c => c.id === custodiaInfo.id);
              return exists ? prev : [...prev, custodiaInfo];
            });
          } else if (alloc.transfer) {
            tipo = 'transfer';
            entidade_id = alloc.transfer.id;

            // Adicionar a transferência à lista se não estiver presente
            const transferInfo = {
              id: alloc.transfer.id,
              from_bank_nome: alloc.transfer.from_bank,
              to_bank_nome: alloc.transfer.to_bank,
              valor: String(alloc.transfer.valor || 0),
              status: alloc.transfer.status,
              status_display: alloc.transfer.status_display,
            } as Transfer;

            setTransfers(prev => {
              const exists = prev.some(t => t.id === transferInfo.id);
              return exists ? prev : [...prev, transferInfo];
            });
          }

          return {
            id: `alloc-${index}-${Date.now()}`,
            allocation_id: alloc.id, // Guardar o ID da alocação existente
            tipo,
            entidade_id,
            valor: alloc.valor,
            valorDisplay: formatCurrencyInput(alloc.valor),
            isExisting: true, // Marcar como existente
          };
        });
        setAllocations(loadedAllocations);
      } else {
        setAllocations([]);
      }
    } else {
      setFormData({
        tipo: 'E',
        conta_bancaria: 0,
        valor: 0,
        data_pagamento: '',
        observacao: '',
      });
      setValorDisplay('');
      setAllocations([]);
    }
  }, [payment, open]);

  // ======================
  // 🔹 LOAD AUX DATA
  // ======================
  useEffect(() => {
    if (open) {
      loadBancos();
      loadReceitas();
      loadDespesas();
      loadCustodias();
      loadTransfers();
    }
  }, [open]);

  // ======================
  // 🔹 ADJUST ALLOCATIONS WHEN PAYMENT TYPE CHANGES
  // ======================
  useEffect(() => {
    // Ajusta as alocações quando o tipo de pagamento muda
    setAllocations((prev) => {
      if (prev.length === 0) return prev;

      const updatedAllocations = prev.map((alloc) => {
        // Se for Recebimento (E) e a alocação é despesa, mudar para receita
        if (formData.tipo === 'E' && alloc.tipo === 'despesa') {
          return { ...alloc, tipo: 'receita' as const, entidade_id: 0 };
        }
        // Se for Saída (S) e a alocação é receita, mudar para despesa
        if (formData.tipo === 'S' && alloc.tipo === 'receita') {
          return { ...alloc, tipo: 'despesa' as const, entidade_id: 0 };
        }
        return alloc;
      });

      // Só atualiza se houve mudanças
      if (JSON.stringify(updatedAllocations) !== JSON.stringify(prev)) {
        return updatedAllocations;
      }
      return prev;
    });
  }, [formData.tipo]);

  const loadBancos = async () => {
    try {
      const res = await getBancos({ page_size: 1000 });
      setBancos(res.results);
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
    }
  };

  const loadReceitas = async () => {
    try {
      const res = await getReceitasAbertas({ page_size: 1000 });
      setReceitas(res.results);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
    }
  };

  const loadDespesas = async () => {
    try {
      const res = await getDespesasAbertas({ page_size: 1000 });
      setDespesas(res.results);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    }
  };

  const loadCustodias = async () => {
    try {
      const res = await getCustodiasAbertas({ page_size: 1000 });
      setCustodias(res.results);
    } catch (error) {
      console.error('Erro ao carregar custódias:', error);
    }
  };

  const loadTransfers = async () => {
    try {
      const res = await transfersService.list({ page_size: 1000 });
      // Filtrar transferências com status "Completo" (C)
      const transfersFiltered = res.results.filter(t => t.status !== 'C');
      setTransfers(transfersFiltered);
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
    }
  };

  // ======================
  // 🔹 ALLOCATION MANAGEMENT
  // ======================
  const addAllocation = () => {
    // Define o tipo padrão baseado no tipo de pagamento
    const tipoDefault = formData.tipo === 'E' ? 'receita' : 'despesa';

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
    // Filtrar alocações não deletadas
    const activeAllocations = allocations.filter((a) => !a.isDeleted);

    // Identificar alocações a deletar (existentes marcadas como deleted)
    const allocationsToDelete = allocations
      .filter((a) => a.isExisting && a.isDeleted && a.allocation_id)
      .map((a) => a.allocation_id!);

    const payload: PaymentCreate & {
      allocations?: AllocationForm[];
      allocationsToDelete?: number[];
    } = {
      ...formData,
    };

    // Adicionar apenas alocações ativas (novas ou existentes não deletadas)
    if (activeAllocations.length > 0) {
      payload.allocations = activeAllocations;
    }

    // Adicionar IDs de alocações a deletar
    if (allocationsToDelete.length > 0) {
      payload.allocationsToDelete = allocationsToDelete;
    }

    await onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={payment ? 'Editar Pagamento' : 'Novo Pagamento'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Tipo + Data + Conta */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Tipo *</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val as 'E' | 'S' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="E">Entrada (Recebimento)</SelectItem>
                <SelectItem value="S">Saída (Pagamento)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Data *</label>
            <Input
              type="date"
              value={formData.data_pagamento}
              onChange={(e) =>
                setFormData({ ...formData, data_pagamento: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Conta Bancária *</label>
            <AntdSelect
              showSearch
              placeholder="Selecione uma conta"
              value={formData.conta_bancaria || undefined}
              options={bancos.map((b) => ({
                value: b.id,
                label: b.nome,
              }))}
              onChange={(val) =>
                setFormData({ ...formData, conta_bancaria: val })
              }
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Valor Total */}
        <div>
          <label className="text-sm font-medium">Valor Total (R$) *</label>
          <Input
            placeholder="0,00"
            value={valorDisplay}
            onChange={(e) => setValorDisplay(e.target.value)}
            onBlur={() => {
              const parsed = parseCurrencyBR(valorDisplay);
              setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
              setFormData((prev) => ({ ...prev, valor: parsed }));
            }}
          />
        </div>

        {/* Observação */}
        <div>
          <label className="text-sm font-medium">Observação</label>
          <Input
            placeholder="Observações sobre o pagamento (opcional)"
            value={formData.observacao}
            onChange={(e) =>
              setFormData({ ...formData, observacao: e.target.value })
            }
          />
        </div>

        {/* Alocações */}
        <div className="space-y-4 border-t pt-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">Alocações (opcional)</h3>
              <p className="text-xs text-muted-foreground">
                Vincule este pagamento a receitas, despesas ou custódias
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
            {allocations.filter((a) => !a.isDeleted).map((alloc) => (
                <div key={alloc.id} className={`grid grid-cols-12 gap-2 items-end p-2 rounded ${
                  alloc.isExisting ? 'bg-blue-50 border border-blue-200' : ''
                }`}>
                  {/* Tipo */}
                  <div className="col-span-3">
                    <label className="text-xs font-medium block mb-1">
                      Tipo
                      {alloc.isExisting && (
                        <span className="ml-1 text-blue-600 text-xs">(Existente)</span>
                      )}
                    </label>
                    <Select
                      key={`tipo-${alloc.id}`}
                      value={alloc.tipo}
                      onValueChange={(val) => {
                        setAllocations((prev) =>
                          prev.map((a) =>
                            a.id === alloc.id
                              ? { ...a, tipo: val as 'receita' | 'despesa' | 'custodia' | 'transfer', entidade_id: 0 }
                              : a
                          )
                        );
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Recebimento (E) só pode alocar em Receita, Custódia ou Transferência */}
                        {/* Saída (S) só pode alocar em Despesa, Custódia ou Transferência */}
                        {formData.tipo === 'E' && <SelectItem value="receita">Receita</SelectItem>}
                        {formData.tipo === 'S' && <SelectItem value="despesa">Despesa</SelectItem>}
                        <SelectItem value="custodia">Custódia</SelectItem>
                        <SelectItem value="transfer">Transferência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Entidade */}
                  <div className="col-span-5">
                    <label className="text-xs font-medium block mb-1">
                      {alloc.tipo === 'receita' ? 'Receita' : alloc.tipo === 'despesa' ? 'Despesa' : alloc.tipo === 'custodia' ? 'Custódia' : 'Transferência'}
                    </label>
                    <AntdSelect
                      key={`entidade-${alloc.id}-${alloc.tipo}`}
                      showSearch
                      placeholder={`Selecione ${alloc.tipo === 'receita' ? 'uma receita' : alloc.tipo === 'despesa' ? 'uma despesa' : alloc.tipo === 'custodia' ? 'uma custódia' : 'uma transferência'}`}
                      value={alloc.entidade_id || undefined}
                      options={
                        alloc.tipo === 'receita'
                          ? receitas.map((r) => ({
                              value: r.id,
                              label: `${r.nome} - ${r.cliente?.nome || 'Sem cliente'}`,
                            }))
                          : alloc.tipo === 'despesa'
                          ? despesas.map((d) => ({
                              value: d.id,
                              label: `${d.nome} - ${d.responsavel?.nome || 'Sem responsável'}`,
                            }))
                          : alloc.tipo === 'custodia'
                          ? custodias.map((c) => ({
                              value: c.id,
                              label: c.nome,
                            }))
                          : transfers.map((t) => ({
                              value: t.id,
                              label: `${t.from_bank_nome} → ${t.to_bank_nome} - ${formatDateBR(t.data_transferencia)}`,
                            }))
                      }
                      onChange={(val) => {
                        updateAllocation(alloc.id, 'entidade_id', val);

                        // Preencher automaticamente o valor em aberto da entidade selecionada
                        let valorAberto = 0;

                        if (alloc.tipo === 'receita') {
                          const receita = receitas.find((r) => r.id === val);
                          if (receita) {
                            // Usa valor_aberto se disponível, senão usa valor total
                            const valorAbertoReceita = Number(receita.valor_aberto);
                            const valorTotalReceita = Number(receita.valor);
                            // Usa o valor_aberto se for válido, senão usa o valor total
                            valorAberto = valorAbertoReceita > 0 ? valorAbertoReceita : valorTotalReceita;
                          }
                        } else if (alloc.tipo === 'despesa') {
                          const despesa = despesas.find((d) => d.id === val);
                          if (despesa) {
                            // Usa valor_aberto se disponível, senão usa valor total
                            const valorAbertoDespesa = Number(despesa.valor_aberto);
                            const valorTotalDespesa = Number(despesa.valor);
                            // Usa o valor_aberto se for válido, senão usa o valor total
                            valorAberto = valorAbertoDespesa > 0 ? valorAbertoDespesa : valorTotalDespesa;
                          }
                        } else if (alloc.tipo === 'custodia') {
                          const custodia = custodias.find((c) => c.id === val);
                          if (custodia) {
                            // Calcula o valor em aberto (total - liquidado)
                            const total = Number(custodia.valor_total) || 0;
                            const liquidado = Number(custodia.valor_liquidado) || 0;
                            valorAberto = Math.max(0, total - liquidado);
                          }
                        } else if (alloc.tipo === 'transfer') {
                          const transfer = transfers.find((t) => t.id === val);
                          if (transfer) {
                            // Para transferências, usar o valor da transferência menos o que já foi alocado
                            const valorTransfer = parseFloat(transfer.valor) || 0;
                            const valorSaida = parseFloat(transfer.valor_saida) || 0;
                            const valorEntrada = parseFloat(transfer.valor_entrada) || 0;

                            // Se for saída, usar valor - valor_saida, se for entrada, usar valor - valor_entrada
                            if (formData.tipo === 'S') {
                              valorAberto = Math.max(0, valorTransfer - valorSaida);
                            } else {
                              valorAberto = Math.max(0, valorTransfer - valorEntrada);
                            }
                          }
                        }

                        // Preenche o valor automaticamente
                        if (valorAberto > 0) {
                          // Se o valor do pagamento está preenchido, usar o menor entre os dois
                          // Senão, usar o valor aberto da entidade
                          const valorAlocar = formData.valor > 0
                            ? Math.min(valorAberto, formData.valor)
                            : valorAberto;

                          updateAllocation(alloc.id, 'valorDisplay', formatCurrencyInput(valorAlocar));
                          updateAllocation(alloc.id, 'valor', valorAlocar);
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
                    <label className="text-xs font-medium block mb-1">Valor (R$)</label>
                    <Input
                      placeholder="0,00"
                      value={alloc.valorDisplay}
                      onChange={(e) =>
                        updateAllocation(alloc.id, 'valorDisplay', e.target.value)
                      }
                      onBlur={() => {
                        const activeAllocations = allocations.filter((a) => !a.isDeleted);
                        const isLastAllocation = activeAllocations[activeAllocations.length - 1].id === alloc.id;
                        const isBlankValue = !alloc.valorDisplay || alloc.valorDisplay.trim() === '';

                        // Se for a última alocação e o valor estiver em branco, calcular o restante
                        if (isLastAllocation && isBlankValue && activeAllocations.length > 0) {
                          const totalAllocated = activeAllocations.reduce((sum, a) => {
                            if (a.id === alloc.id) return sum; // Ignora a última alocação
                            return sum + (a.valor || 0);
                          }, 0);

                          const remaining = formData.valor - totalAllocated;

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
      </div>
    </DialogBase>
  );
}
