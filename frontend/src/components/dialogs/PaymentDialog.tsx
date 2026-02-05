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
import { Select as AntdSelect } from 'antd';
import { Plus, Trash2 } from 'lucide-react';

import { formatCurrencyInput, parseCurrencyBR, formatCurrencyBR } from '@/lib/formatters';

import { getBancos } from '@/services/bancos';
import { getReceitas } from '@/services/receitas';
import { getDespesas } from '@/services/despesas';
import { getCustodiasAbertas } from '@/services/custodias';

import { Banco } from '@/types/bancos';
import { Receita } from '@/types/receitas';
import { Despesa } from '@/types/despesas';
import { Custodia } from '@/types/custodias';
import { Payment, PaymentCreate } from '@/types/payments';

// Tipo para uma alocação no formulário
interface AllocationForm {
  id: string; // ID temporário para gerenciar a lista
  tipo: 'receita' | 'despesa' | 'custodia';
  entidade_id: number;
  valor: number;
  valorDisplay: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentCreate & { allocations?: AllocationForm[] }) => Promise<void>;
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
          let tipo: 'receita' | 'despesa' | 'custodia' = 'receita';
          let entidade_id = 0;

          if (alloc.receita) {
            tipo = 'receita';
            entidade_id = alloc.receita.id;
          } else if (alloc.despesa) {
            tipo = 'despesa';
            entidade_id = alloc.despesa.id;
          } else if (alloc.custodia) {
            tipo = 'custodia';
            entidade_id = alloc.custodia.id;
          }

          return {
            id: `alloc-${index}-${Date.now()}`,
            tipo,
            entidade_id,
            valor: alloc.valor,
            valorDisplay: formatCurrencyInput(alloc.valor),
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
    loadBancos();
    loadReceitas();
    loadDespesas();
    loadCustodias();
  }, []);

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
      const res = await getReceitas({ page_size: 1000, situacao: 'A' });
      setReceitas(res.results);
    } catch (error) {
      console.error('Erro ao carregar receitas:', error);
    }
  };

  const loadDespesas = async () => {
    try {
      const res = await getDespesas({ page_size: 1000, situacao: 'A' });
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

  // ======================
  // 🔹 ALLOCATION MANAGEMENT
  // ======================
  const addAllocation = () => {
    setAllocations([
      ...allocations,
      {
        id: Date.now().toString(),
        tipo: 'receita',
        entidade_id: 0,
        valor: 0,
        valorDisplay: '',
      },
    ]);
  };

  const removeAllocation = (id: string) => {
    setAllocations(allocations.filter((a) => a.id !== id));
  };

  const updateAllocation = (id: string, field: keyof AllocationForm, value: string | number) => {
    setAllocations(
      allocations.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  // ======================
  // 💾 SUBMIT
  // ======================
  const handleSubmit = async () => {
    const payload: PaymentCreate & { allocations?: AllocationForm[] } = {
      ...formData,
    };

    // Adicionar allocations se houver
    if (allocations.length > 0) {
      payload.allocations = allocations;
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
            {allocations.map((alloc) => (
                <div key={alloc.id} className="grid grid-cols-12 gap-2 items-end">
                  {/* Tipo */}
                  <div className="col-span-3">
                    <label className="text-xs font-medium block mb-1">Tipo</label>
                    <Select
                      key={`tipo-${alloc.id}`}
                      value={alloc.tipo}
                      onValueChange={(val) => {
                        setAllocations(
                          allocations.map((a) =>
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
                        <SelectItem value="receita">Receita</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="custodia">Custódia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Entidade */}
                  <div className="col-span-5">
                    <label className="text-xs font-medium block mb-1">
                      {alloc.tipo === 'receita' ? 'Receita' : alloc.tipo === 'despesa' ? 'Despesa' : 'Custódia'}
                    </label>
                    <AntdSelect
                      key={`entidade-${alloc.id}-${alloc.tipo}`}
                      showSearch
                      placeholder={`Selecione ${alloc.tipo === 'receita' ? 'uma receita' : alloc.tipo === 'despesa' ? 'uma despesa' : 'uma custódia'}`}
                      value={alloc.entidade_id || undefined}
                      options={
                        alloc.tipo === 'receita'
                          ? receitas.map((r) => ({
                              value: r.id,
                              label: `${r.nome} - ${r.cliente?.nome || 'Sem cliente'} - ${formatCurrencyBR(r.valor)}`,
                            }))
                          : alloc.tipo === 'despesa'
                          ? despesas.map((d) => ({
                              value: d.id,
                              label: `${d.nome} - ${d.responsavel?.nome || 'Sem responsável'} - ${formatCurrencyBR(d.valor)}`,
                            }))
                          : custodias.map((c) => ({
                              value: c.id,
                              label: `${c.nome} - ${formatCurrencyBR(c.valor_total)}`,
                            }))
                      }
                      onChange={(val) => updateAllocation(alloc.id, 'entidade_id', val)}
                      className="w-full"
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
