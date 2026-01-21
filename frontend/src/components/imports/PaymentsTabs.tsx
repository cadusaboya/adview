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

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

import { createPayment, deletePayment, getPayments } from '@/services/payments';
import PaymentsTable from './PaymentsTable';

export interface PaymentItem {
  id: number;
  data_pagamento: string;
  conta_bancaria: string;
  valor: string;
  observacao?: string;
}

interface Props {
  tipo: 'receita' | 'despesa';
  entityId: number;
  contasBancarias: { id: number; nome: string }[];
}

export default function PaymentsTabs({ tipo, entityId, contasBancarias }: Props) {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [form, setForm] = useState({
    data_pagamento: '',
    conta_bancaria: '',
    valor: 0, // 🔹 valor REAL
    observacao: '',
  });

  const [valorDisplay, setValorDisplay] = useState('');

  const loadPayments = useCallback(async () => {
    try {
      const query =
        tipo === 'receita'
          ? { receita: entityId, page_size: 99999 }
          : { despesa: entityId, page_size: 99999 };
  
      const data = await getPayments(query);
  
      const formatted = (data.results || []).map((p) => ({
        id: p.id,
        data_pagamento: p.data_pagamento,
        conta_bancaria: String(p.conta_bancaria),
        valor: String(p.valor),
        observacao: p.observacao || '',
      }));
  
      setPayments(formatted);
    } catch {
      toast.error('Erro ao carregar pagamentos');
    }
  }, [tipo, entityId]);
  

  useEffect(() => {
    if (entityId) {
      loadPayments();
    }
  }, [entityId, loadPayments]);  

  const handleAdd = async () => {
    if (!form.data_pagamento || !form.conta_bancaria || !form.valor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const novo = await createPayment({
        [tipo]: entityId,
        conta_bancaria: Number(form.conta_bancaria),
        valor: form.valor, // 🔥 número limpo
        data_pagamento: form.data_pagamento,
        observacao: form.observacao,
      });

      setPayments((prev) => [
        ...prev,
        {
          id: novo.id,
          data_pagamento: novo.data_pagamento,
          conta_bancaria: String(novo.conta_bancaria),
          valor: String(novo.valor),
          observacao: novo.observacao || '',
        },
      ]);

      toast.success('Pagamento adicionado');

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
      await deletePayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success('Pagamento removido');
    } catch {
      toast.error('Erro ao remover pagamento');
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

          {/* 🔹 VALOR COM UX CORRETA */}
          <div>
            <label className="text-sm">Valor</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorDisplay}

              onChange={(e) => {
                setValorDisplay(e.target.value);
              }}

              onFocus={() => {
                setValorDisplay(
                  valorDisplay.replace(/[^\d,]/g, '')
                );
              }}

              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);

                setValorDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );

                setForm((prev) => ({
                  ...prev,
                  valor: parsed,
                }));
              }}
            />
          </div>

          <div>
            <label className="text-sm">Observação (opcional)</label>
            <Input
              placeholder="Ex.: Pix, Boleto, Referente a..."
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
