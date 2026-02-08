'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';

import { formatCurrencyInput, parseCurrencyBR, formatCurrencyBR } from '@/lib/formatters';
import { createPayment, getPayments, deletePayment } from '@/services/payments';
import { createAllocation, deleteAllocation, getAllocations } from '@/services/allocations';
import PaymentsTable from './PaymentsTable';
import { Payment } from '@/types/payments';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export interface PaymentUI {
  id: number; // Payment ID
  allocation_id?: number; // Allocation ID (para deletar)
  data_pagamento: string;
  conta_bancaria: number;
  valor: number;
  observacao?: string;
}

interface Props {
  tipo: 'receita' | 'despesa' | 'custodia';
  entityId: number;
  contasBancarias: { id: number; nome: string }[];
  custodiaTipo?: 'P' | 'A'; // P = Passivo, A = Ativo (apenas para custódia)
  valorAberto?: number; // Valor em aberto da entidade para filtrar pagamentos
  initialPayments?: PaymentUI[]; // Pagamentos pré-carregados
}

export default function PaymentsTabs({ tipo, entityId, contasBancarias, custodiaTipo, valorAberto, initialPayments }: Props) {
  const [payments, setPayments] = useState<PaymentUI[]>(initialPayments || []);
  const [valorDisplay, setValorDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(!initialPayments); // Só carrega se não tem dados iniciais

  const [form, setForm] = useState({
    data_pagamento: '',
    conta_bancaria: '',
    valor: 0,
    observacao: '',
  });

  // Estado para a tab "Vincular"
  const [availablePayments, setAvailablePayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [vincularValorDisplay, setVincularValorDisplay] = useState('');
  const [vincularValor, setVincularValor] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const loadPayments = useCallback(async () => {
    // Se já tem dados iniciais, não precisa carregar
    if (initialPayments) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Buscar allocations ao invés de payments diretos
      const query =
        tipo === 'receita'
          ? { receita_id: entityId, page_size: 9999 }
          : tipo === 'despesa'
          ? { despesa_id: entityId, page_size: 9999 }
          : { custodia_id: entityId, page_size: 9999 };

      const res = await getAllocations(query);

      // Mapear allocations para o formato esperado (usando dados do payment)
      setPayments(
        res.results.map((alloc) => ({
          id: alloc.payment, // ID do payment (para gerar recibo)
          allocation_id: alloc.id, // Guardar o ID da allocation para deletar
          data_pagamento: alloc.payment_info?.data_pagamento || '',
          conta_bancaria: Number(alloc.payment_info?.conta_bancaria) || 0, // ID da conta bancária
          valor: alloc.valor, // Valor da alocação (pode ser diferente do payment total)
          observacao: alloc.observacao || '',
        }))
      );
    } catch {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setIsLoading(false);
    }
  }, [tipo, entityId, initialPayments]);

  useEffect(() => {
    if (entityId) loadPayments();
  }, [entityId, loadPayments]);

  const handleAdd = async () => {
    if (!form.data_pagamento || !form.conta_bancaria || !form.valor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      // 1. Criar Payment (neutro)
      // Determina o tipo de payment baseado na entidade:
      // - Receita: Entrada (recebimento)
      // - Despesa: Saída (pagamento)
      // - Custódia Passivo (P): Saída (repasse - dá baixa)
      // - Custódia Ativo (A): Entrada (reembolso - dá baixa)
      let paymentTipo: 'E' | 'S' = 'S';
      if (tipo === 'receita') {
        paymentTipo = 'E';
      } else if (tipo === 'despesa') {
        paymentTipo = 'S';
      } else if (tipo === 'custodia') {
        paymentTipo = custodiaTipo === 'A' ? 'E' : 'S';
      }

      const novoPayment = await createPayment({
        tipo: paymentTipo,
        conta_bancaria: Number(form.conta_bancaria),
        valor: form.valor,
        data_pagamento: form.data_pagamento,
        observacao: form.observacao,
      });

      // 2. Criar Allocation vinculando Payment à Receita/Despesa/Custódia
      const allocationPayload: {
        payment_id: number;
        valor: number;
        observacao?: string;
        receita_id?: number;
        despesa_id?: number;
        custodia_id?: number;
      } = {
        payment_id: novoPayment.id,
        valor: form.valor,
        observacao: form.observacao,
      };

      if (tipo === 'receita') {
        allocationPayload.receita_id = entityId;
      } else if (tipo === 'despesa') {
        allocationPayload.despesa_id = entityId;
      } else {
        allocationPayload.custodia_id = entityId;
      }

      const novaAllocation = await createAllocation(allocationPayload);

      // 3. Adicionar à lista local
      setPayments((prev) => [
        ...prev,
        {
          id: novoPayment.id,
          allocation_id: novaAllocation.id,
          data_pagamento: novoPayment.data_pagamento,
          conta_bancaria: novoPayment.conta_bancaria,
          valor: novaAllocation.valor,
          observacao: form.observacao,
        },
      ]);

      toast.success('Pagamento adicionado');

      // Limpar formulário
      setForm({
        data_pagamento: '',
        conta_bancaria: '',
        valor: 0,
        observacao: '',
      });
      setValorDisplay('');
    } catch {
      toast.error('Erro ao adicionar pagamento');
    }
  };

  const handleUnlink = async (id: number) => {
    try {
      // Encontrar a allocation_id correspondente ao payment_id
      const payment = payments.find((p) => p.id === id);
      if (!payment?.allocation_id) {
        toast.error('Allocation ID não encontrado');
        return;
      }

      // Deletar apenas a allocation (desvincula o payment)
      // O backend irá:
      // 1. Deletar a allocation
      // 2. Atualizar o status da receita/despesa/custódia
      // 3. O Payment continua existindo (pode ter outras allocations)
      await deleteAllocation(payment.allocation_id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success('Vínculo removido com sucesso');
    } catch {
      toast.error('Erro ao remover vínculo');
    }
  };

  const handleDeleteAction = async (id: number) => {
    try {
      // Apagar o payment completamente
      // O backend irá:
      // 1. Deletar todas as allocations relacionadas
      // 2. Deletar o payment
      // 3. Atualizar o status das receitas/despesas/custódias vinculadas
      await deletePayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success('Pagamento apagado com sucesso');
    } catch {
      toast.error('Erro ao apagar pagamento');
    }
  };

  const {
    confirmState,
    confirmDelete,
    handleConfirm,
    handleCancel,
  } = useDeleteConfirmation({
    onDelete: handleDeleteAction,
  });

  const handleDelete = (id: number) => {
    const payment = payments.find((p) => p.id === id);
    confirmDelete(id, payment?.observacao);
  };

  // Carregar pagamentos disponíveis para vincular
  const loadAvailablePayments = useCallback(async () => {
    try {
      // Determina o tipo de payment baseado na entidade
      let paymentTipo: 'E' | 'S' | undefined = undefined;
      if (tipo === 'receita') {
        paymentTipo = 'E';
      } else if (tipo === 'despesa') {
        paymentTipo = 'S';
      } else if (tipo === 'custodia') {
        paymentTipo = custodiaTipo === 'A' ? 'E' : 'S';
      }

      const res = await getPayments({
        tipo: paymentTipo,
        page_size: 9999
      });

      // Filtrar pagamentos que ainda têm valor disponível para vincular
      const paymentsWithValueAvailable = res.results.filter((p) => {
        // Calcular o valor já alocado
        const valorAlocado = p.allocations_info?.reduce((sum, alloc) => sum + alloc.valor, 0) || 0;
        // Calcular o valor remanescente
        const valorRemanescente = p.valor - valorAlocado;
        // Incluir apenas pagamentos com valor disponível (tolerância para floats)
        return valorRemanescente > 0.01;
      });

      // Guardar TODOS os pagamentos com valor disponível (sem filtro de valor igual)
      // O filtro por valor igual será aplicado no filteredAvailablePayments apenas quando não houver pesquisa
      setAvailablePayments(paymentsWithValueAvailable);
    } catch {
      toast.error('Erro ao carregar pagamentos disponíveis');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, custodiaTipo, valorAberto]);

  // Filtrar pagamentos disponíveis com base no termo de pesquisa
  const filteredAvailablePayments = availablePayments.filter((payment) => {
    const valorAlocado = payment.allocations_info?.reduce((sum, alloc) => sum + alloc.valor, 0) || 0;
    const valorDisponivel = payment.valor - valorAlocado;

    // Se não houver termo de pesquisa, filtrar por valor igual (comportamento padrão)
    if (!searchTerm) {
      // Se valorAberto existir, mostrar apenas pagamentos com valor igual
      if (valorAberto) {
        return Math.abs(valorDisponivel - valorAberto) < 0.01;
      }
      // Se não houver valorAberto, mostrar todos
      return true;
    }

    // Se houver termo de pesquisa, buscar em todos os pagamentos disponíveis
    const search = searchTerm.toLowerCase();

    // Pesquisar por data (formato brasileiro)
    const dataFormatada = new Date(payment.data_pagamento).toLocaleDateString('pt-BR');
    if (dataFormatada.includes(search)) return true;

    // Pesquisar por valor total
    const valorTotalStr = formatCurrencyBR(payment.valor).toLowerCase();
    if (valorTotalStr.includes(search)) return true;

    // Pesquisar por valor disponível
    const valorDisponivelStr = formatCurrencyBR(valorDisponivel).toLowerCase();
    if (valorDisponivelStr.includes(search)) return true;

    // Pesquisar por observação
    if (payment.observacao?.toLowerCase().includes(search)) return true;

    return false;
  });

  // Vincular um payment existente
  const handleVincular = async () => {
    if (!selectedPaymentId || !vincularValor) {
      toast.error('Selecione um pagamento e informe o valor');
      return;
    }

    try {
      const allocationPayload: {
        payment_id: number;
        valor: number;
        receita_id?: number;
        despesa_id?: number;
        custodia_id?: number;
      } = {
        payment_id: selectedPaymentId,
        valor: vincularValor,
      };

      if (tipo === 'receita') {
        allocationPayload.receita_id = entityId;
      } else if (tipo === 'despesa') {
        allocationPayload.despesa_id = entityId;
      } else {
        allocationPayload.custodia_id = entityId;
      }

      const novaAllocation = await createAllocation(allocationPayload);

      // Buscar o payment selecionado para adicionar à lista
      const selectedPayment = availablePayments.find((p) => p.id === selectedPaymentId);

      if (selectedPayment) {
        setPayments((prev) => [
          ...prev,
          {
            id: selectedPayment.id,
            allocation_id: novaAllocation.id,
            data_pagamento: selectedPayment.data_pagamento,
            conta_bancaria: selectedPayment.conta_bancaria,
            valor: vincularValor,
            observacao: selectedPayment.observacao,
          },
        ]);
      }

      toast.success('Pagamento vinculado com sucesso');

      // Limpar formulário
      setSelectedPaymentId(null);
      setVincularValorDisplay('');
      setVincularValor(0);

      // Recarregar pagamentos disponíveis
      loadAvailablePayments();
    } catch {
      toast.error('Erro ao vincular pagamento');
    }
  };

  return (
    <Tabs defaultValue="pagamentos" className="w-full" onValueChange={(value) => {
      if (value === 'vincular') {
        loadAvailablePayments();
      }
    }}>
      <TabsList>
        <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        <TabsTrigger value="baixa">Baixa</TabsTrigger>
        <TabsTrigger value="vincular">Vincular</TabsTrigger>
      </TabsList>

      <TabsContent value="pagamentos" className="min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
            <p className="text-sm text-muted-foreground">Carregando pagamentos...</p>
          </div>
        ) : (
          <PaymentsTable
            payments={payments}
            contasBancarias={contasBancarias}
            onDelete={handleDelete}
            onUnlink={handleUnlink}
            tipo={tipo}
          />
        )}
      </TabsContent>

      <TabsContent value="baixa" className="min-h-[400px]">
        <div className="border rounded-md p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm">Data do Pagamento</label>
              <Input
                type="date"
                value={form.data_pagamento}
                onChange={(e) =>
                  setForm({ ...form, data_pagamento: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm">Conta Bancária</label>
              <Select
                value={form.conta_bancaria}
                onValueChange={(val) =>
                  setForm({ ...form, conta_bancaria: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm">Valor</label>
              <Input
                placeholder="0,00"
                value={valorDisplay}
                onChange={(e) => setValorDisplay(e.target.value)}
                onBlur={() => {
                  const parsed = parseCurrencyBR(valorDisplay);
                  setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
                  setForm((prev) => ({ ...prev, valor: parsed }));
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm">Observação</label>
            <Input
              placeholder="Observações sobre o pagamento (opcional)"
              value={form.observacao}
              onChange={(e) =>
                setForm({ ...form, observacao: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleAdd}>Adicionar Pagamento</Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="vincular" className="min-h-[400px]">
        <div className="border rounded-md p-4 space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Selecione um pagamento já existente para vincular a esta {tipo === 'receita' ? 'receita' : tipo === 'despesa' ? 'despesa' : 'custódia'}
          </div>

          {/* Campo de pesquisa */}
          <div>
            <Input
              placeholder="Pesquisar por data, valor ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Lista de pagamentos disponíveis */}
          <div className="border rounded-md overflow-y-auto">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2 text-xs">Selecionar</th>
                  <th className="text-left p-2 text-xs">Data</th>
                  <th className="text-left p-2 text-xs">Conta</th>
                  <th className="text-right p-2 text-xs">Valor Total</th>
                  <th className="text-right p-2 text-xs">Valor Disponível</th>
                  <th className="text-left p-2 text-xs">Observação</th>
                </tr>
              </thead>
              <tbody>
                {filteredAvailablePayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-4 text-sm text-muted-foreground">
                      {searchTerm ? 'Nenhum pagamento encontrado' : 'Nenhum pagamento disponível'}
                    </td>
                  </tr>
                ) : (
                  filteredAvailablePayments.map((payment) => {
                    const valorAlocado = payment.allocations_info?.reduce((sum, alloc) => sum + alloc.valor, 0) || 0;
                    const valorDisponivel = payment.valor - valorAlocado;

                    return (
                      <tr
                        key={payment.id}
                        className={`hover:bg-muted/50 cursor-pointer ${
                          selectedPaymentId === payment.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => {
                          setSelectedPaymentId(payment.id);
                          setVincularValorDisplay(formatCurrencyInput(valorDisponivel));
                          setVincularValor(valorDisponivel);
                        }}
                      >
                        <td className="p-2">
                          <input
                            type="radio"
                            checked={selectedPaymentId === payment.id}
                            onChange={() => {
                              setSelectedPaymentId(payment.id);
                              setVincularValorDisplay(formatCurrencyInput(valorDisponivel));
                              setVincularValor(valorDisponivel);
                            }}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-sm">
                          {new Date(payment.data_pagamento).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-2 text-sm">
                          {contasBancarias.find((c) => c.id === payment.conta_bancaria)?.nome || '-'}
                        </td>
                        <td className="p-2 text-sm text-right font-medium">
                          {formatCurrencyBR(payment.valor)}
                        </td>
                        <td className="p-2 text-sm text-right font-semibold text-green-600">
                          {formatCurrencyBR(valorDisponivel)}
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {payment.observacao || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Formulário de vinculação */}
          {selectedPaymentId && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium">Valor a vincular (R$)</label>
                <Input
                  placeholder="0,00"
                  value={vincularValorDisplay}
                  onChange={(e) => setVincularValorDisplay(e.target.value)}
                  onBlur={() => {
                    const parsed = parseCurrencyBR(vincularValorDisplay);
                    setVincularValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
                    setVincularValor(parsed);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode vincular um valor parcial do pagamento
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPaymentId(null);
                    setVincularValorDisplay('');
                    setVincularValor(0);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleVincular}>Vincular Pagamento</Button>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <DeleteConfirmationDialog
        open={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title="Excluir pagamento?"
        itemName={confirmState.itemName}
        isBulk={false}
        itemCount={0}
      />
    </Tabs>
  );
}
