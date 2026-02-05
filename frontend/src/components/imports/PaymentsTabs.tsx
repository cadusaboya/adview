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

import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';
import { createPayment } from '@/services/payments';
import { createAllocation, deleteAllocation, getAllocations } from '@/services/allocations';
import PaymentsTable from './PaymentsTable';

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
}

export default function PaymentsTabs({ tipo, entityId, contasBancarias, custodiaTipo }: Props) {
  const [payments, setPayments] = useState<PaymentUI[]>([]);
  const [valorDisplay, setValorDisplay] = useState('');

  const [form, setForm] = useState({
    data_pagamento: '',
    conta_bancaria: '',
    valor: 0,
    observacao: '',
  });

  const loadPayments = useCallback(async () => {
    try {
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
    }
  }, [tipo, entityId]);

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

  const handleDelete = async (id: number) => {
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

  return (
    <Tabs defaultValue="pagamentos" className="w-full">
      <TabsList>
        <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        <TabsTrigger value="baixa">Baixa</TabsTrigger>
      </TabsList>

      <TabsContent value="pagamentos">
        <PaymentsTable
          payments={payments}
          contasBancarias={contasBancarias}
          onDelete={handleDelete}
        />
      </TabsContent>

      <TabsContent value="baixa">
        <div className="border rounded-md p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </Tabs>
  );
}
