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
import { Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';
import { createPayment, deletePayment } from '@/services/payments';
import { createAllocation, getAllocations, deleteAllocation } from '@/services/allocations';
import PaymentsTable from './PaymentsTable';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

import { Custodia } from '@/types/custodias';

interface PaymentUI {
  id: number;
  allocation_id: number;
  data_pagamento: string;
  conta_bancaria: number;
  valor: number;
  observacao: string;
  payment_tipo: 'E' | 'S';
}

interface Props {
  custodia: Custodia;
  contasBancarias: { id: number; nome: string }[];
}

const emptyForm = {
  data_pagamento: '',
  conta_bancaria: '',
  valor: 0,
  observacao: '',
};

export default function CustodiaPaymentsTabs({ custodia, contasBancarias }: Props) {
  const [payments, setPayments] = useState<PaymentUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showFormEntrada, setShowFormEntrada] = useState(false);
  const [formEntrada, setFormEntrada] = useState(emptyForm);
  const [valorEntradaDisplay, setValorEntradaDisplay] = useState('');

  const [showFormSaida, setShowFormSaida] = useState(false);
  const [formSaida, setFormSaida] = useState(emptyForm);
  const [valorSaidaDisplay, setValorSaidaDisplay] = useState('');

  const loadPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getAllocations({ custodia_id: custodia.id, page_size: 9999 });
      setPayments(
        res.results.map((alloc) => ({
          id: alloc.payment,
          allocation_id: alloc.id,
          data_pagamento: alloc.payment_info?.data_pagamento || '',
          conta_bancaria: Number(alloc.payment_info?.conta_bancaria) || 0,
          valor: alloc.valor,
          observacao: alloc.observacao || '',
          payment_tipo: alloc.payment_info?.tipo ?? 'E',
        }))
      );
    } catch {
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setIsLoading(false);
    }
  }, [custodia.id]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const entradas = payments.filter((p) => p.payment_tipo === 'E');
  const saidas = payments.filter((p) => p.payment_tipo === 'S');

  const handleAdd = async (tipo: 'E' | 'S') => {
    if (isSubmitting) return;
    const form = tipo === 'E' ? formEntrada : formSaida;

    if (!form.data_pagamento || !form.conta_bancaria || !form.valor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsSubmitting(true);
      const novoPayment = await createPayment({
        tipo,
        conta_bancaria: Number(form.conta_bancaria),
        valor: form.valor,
        data_pagamento: form.data_pagamento,
        observacao: form.observacao,
      });

      const novaAllocation = await createAllocation({
        payment_id: novoPayment.id,
        valor: form.valor,
        custodia_id: custodia.id,
        observacao: form.observacao,
      });

      setPayments((prev) => [
        ...prev,
        {
          id: novoPayment.id,
          allocation_id: novaAllocation.id,
          data_pagamento: novoPayment.data_pagamento,
          conta_bancaria: novoPayment.conta_bancaria,
          valor: novaAllocation.valor,
          observacao: form.observacao,
          payment_tipo: tipo,
        },
      ]);

      toast.success(tipo === 'E' ? 'Entrada registrada' : 'Saída registrada');

      if (tipo === 'E') {
        setFormEntrada(emptyForm);
        setValorEntradaDisplay('');
        setShowFormEntrada(false);
      } else {
        setFormSaida(emptyForm);
        setValorSaidaDisplay('');
        setShowFormSaida(false);
      }
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (id: number) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment?.allocation_id) return;
    try {
      await deleteAllocation(payment.allocation_id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success('Vínculo removido');
    } catch {
      toast.error('Erro ao remover vínculo');
    }
  };

  const handleDeleteAction = async (id: number) => {
    await deletePayment(id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
    toast.success('Pagamento apagado');
  };

  const { confirmState, confirmDelete, handleConfirm, handleCancel } = useDeleteConfirmation({
    onDelete: handleDeleteAction,
  });

  const handleDeleteClick = (id: number) => {
    const payment = payments.find((p) => p.id === id);
    confirmDelete(id, payment?.observacao);
  };

  // Labels contextuais por tipo de custódia
  const entradaLabel = custodia.tipo === 'P' ? 'Recebimentos' : 'Retornos';
  const saidaLabel = custodia.tipo === 'P' ? 'Repasses' : 'Depósitos';
  const entradaLabelSingular = custodia.tipo === 'P' ? 'recebimento' : 'retorno';
  const saidaLabelSingular = custodia.tipo === 'P' ? 'repasse' : 'depósito';

  // Tab padrão: onde ocorre a "baixa" de cada tipo
  // Passiva → repasse ao cliente → Saídas
  // Ativa   → retorno à empresa  → Entradas
  const defaultTab = custodia.tipo === 'P' ? 'saidas' : 'entradas';

  return (
    <>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="entradas" className="gap-1.5">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            {entradaLabel}
            {entradas.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full font-medium">
                {entradas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="saidas" className="gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {saidaLabel}
            {saidas.length > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full font-medium">
                {saidas.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Entradas ── */}
        <TabsContent value="entradas" className="space-y-3 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : (
            <PaymentsTable
              payments={entradas}
              contasBancarias={contasBancarias}
              onDelete={handleDeleteClick}
              onUnlink={handleUnlink}
              tipo="custodia"
            />
          )}

          {/* Formulário de nova entrada */}
          {!showFormEntrada ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setShowFormEntrada(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Registrar {entradaLabelSingular}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nova Entrada
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setShowFormEntrada(false);
                    setFormEntrada(emptyForm);
                    setValorEntradaDisplay('');
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Data <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formEntrada.data_pagamento}
                      onChange={(e) =>
                        setFormEntrada({ ...formEntrada, data_pagamento: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Conta Bancária <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formEntrada.conta_bancaria}
                      onValueChange={(val) =>
                        setFormEntrada({ ...formEntrada, conta_bancaria: val })
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Valor (R$) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="0,00"
                      value={valorEntradaDisplay}
                      onChange={(e) => setValorEntradaDisplay(e.target.value)}
                      onBlur={() => {
                        const parsed = parseCurrencyBR(valorEntradaDisplay);
                        setValorEntradaDisplay(parsed ? formatCurrencyInput(parsed) : '');
                        setFormEntrada((prev) => ({ ...prev, valor: parsed }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observação</label>
                  <Input
                    placeholder="Observação (opcional)"
                    value={formEntrada.observacao}
                    onChange={(e) =>
                      setFormEntrada({ ...formEntrada, observacao: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleAdd('E')} disabled={isSubmitting}>
                    {isSubmitting ? 'Registrando...' : 'Registrar Entrada'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab Saídas ── */}
        <TabsContent value="saidas" className="space-y-3 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          ) : (
            <PaymentsTable
              payments={saidas}
              contasBancarias={contasBancarias}
              onDelete={handleDeleteClick}
              onUnlink={handleUnlink}
              tipo="custodia"
            />
          )}

          {/* Formulário de nova saída */}
          {!showFormSaida ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() => setShowFormSaida(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Registrar {saidaLabelSingular}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nova Saída
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setShowFormSaida(false);
                    setFormSaida(emptyForm);
                    setValorSaidaDisplay('');
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="border rounded-md p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Data <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formSaida.data_pagamento}
                      onChange={(e) =>
                        setFormSaida({ ...formSaida, data_pagamento: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Conta Bancária <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formSaida.conta_bancaria}
                      onValueChange={(val) =>
                        setFormSaida({ ...formSaida, conta_bancaria: val })
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Valor (R$) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="0,00"
                      value={valorSaidaDisplay}
                      onChange={(e) => setValorSaidaDisplay(e.target.value)}
                      onBlur={() => {
                        const parsed = parseCurrencyBR(valorSaidaDisplay);
                        setValorSaidaDisplay(parsed ? formatCurrencyInput(parsed) : '');
                        setFormSaida((prev) => ({ ...prev, valor: parsed }));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observação</label>
                  <Input
                    placeholder="Observação (opcional)"
                    value={formSaida.observacao}
                    onChange={(e) =>
                      setFormSaida({ ...formSaida, observacao: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => handleAdd('S')} disabled={isSubmitting}>
                    {isSubmitting ? 'Registrando...' : 'Registrar Saída'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DeleteConfirmationDialog
        open={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title="Excluir pagamento?"
        itemName={confirmState.itemName}
        isBulk={false}
        itemCount={0}
      />
    </>
  );
}
