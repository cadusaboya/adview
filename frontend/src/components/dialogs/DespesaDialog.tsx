'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

import { Select as AntdSelect } from 'antd';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getBancos } from '@/services/bancos';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';

import {
  Despesa,
  DespesaCreate,
  DespesaUpdate,
} from '@/types/despesas';

interface DespesaCreateWithPayment extends DespesaCreate {
  marcar_como_pago?: boolean;
  data_pagamento?: string | null;
  conta_bancaria_id?: number;
  observacao_pagamento?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DespesaCreate | DespesaUpdate) => Promise<void>;
  despesa?: Despesa | null;
}

export default function DespesaDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  // 🔹 Form SEMPRE baseado em DespesaCreate
  const [formData, setFormData] = useState<DespesaCreate>({
    nome: '',
    descricao: '',
    responsavel_id: 0,
    valor: 0,
    data_vencimento: '',
    tipo: 'F',
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);

  // Estado para marcar como pago
  const [marcarComoPago, setMarcarComoPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [contaBancariaId, setContaBancariaId] = useState<number | undefined>();
  const [observacaoPagamento, setObservacaoPagamento] = useState('');

  // ======================
  // 🔄 Preencher ao editar
  // ======================
  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome,
        descricao: despesa.descricao,
        responsavel_id: despesa.responsavel?.id ?? despesa.responsavel_id,
        valor: despesa.valor,
        data_vencimento: despesa.data_vencimento,
        tipo: despesa.tipo,
      });

      setValorDisplay(
        despesa.valor ? formatCurrencyInput(despesa.valor) : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: 0,
        valor: 0,
        data_vencimento: '',
        tipo: 'F',
      });
      setValorDisplay('');
      setMarcarComoPago(false);
      setDataPagamento('');
      setContaBancariaId(undefined);
      setObservacaoPagamento('');
    }
  }, [despesa, open]);

  // ======================
  // 🔹 Bancos
  // ======================
  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 });
      setBancos(results.map((b) => ({ id: b.id, nome: b.nome })));
    };
    loadBancos();
  }, []);

  // ======================
  // 🔹 Favorecidos
  // ======================
  useEffect(() => {
    const loadFavorecidos = async () => {
      const { results } = await getFavorecidos({ page_size: 1000 });
      setFavorecidos(results);
    };
    loadFavorecidos();
  }, []);

  // ======================
  // 💾 Submit
  // ======================
  const handleSubmit = async () => {
    if (despesa) {
      const payload: DespesaUpdate = { ...formData };
      await onSubmit(payload);
    } else {
      const payload: DespesaCreateWithPayment = { ...formData };

      // Se marcar como pago, incluir dados do pagamento
      if (marcarComoPago) {
        payload.marcar_como_pago = true;
        payload.data_pagamento = dataPagamento;
        payload.conta_bancaria_id = contaBancariaId;
        payload.observacao_pagamento = observacaoPagamento;
      }

      await onSubmit(payload as DespesaCreate);
    }

    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={despesa ? 'Editar Despesa' : 'Nova Despesa'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Favorecido</label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um favorecido"
              value={formData.responsavel_id || undefined}
              options={favorecidos.map((f) => ({
                value: f.id,
                label: f.nome,
              }))}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  responsavel_id: val ?? 0,
                })
              }
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome da despesa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            placeholder="Detalhes sobre a despesa"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* Valor / Vencimento / Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );
                setFormData((prev) => ({
                  ...prev,
                  valor: parsed,
                }));
              }}
            />
          </div>

          <div>
            <label className="text-sm">Data de Vencimento</label>
            <Input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  data_vencimento: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val as DespesaCreate['tipo'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixa</SelectItem>
                <SelectItem value="V">Variável</SelectItem>
                <SelectItem value="C">Comissão</SelectItem>
                <SelectItem value="R">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Marcar como pago (apenas na criação) */}
        {!despesa && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="marcar-pago"
                checked={marcarComoPago}
                onCheckedChange={(checked) =>
                  setMarcarComoPago(checked === true)
                }
              />
              <label
                htmlFor="marcar-pago"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Marcar como pago
              </label>
            </div>

            {marcarComoPago && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                <div>
                  <label className="text-sm">Data de Pagamento</label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm">Conta Bancária</label>
                  <AntdSelect
                    showSearch
                    allowClear
                    placeholder="Selecione uma conta"
                    value={contaBancariaId}
                    options={bancos.map((b) => ({
                      value: b.id,
                      label: b.nome,
                    }))}
                    onChange={(val) => setContaBancariaId(val)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="text-sm">Observação (opcional)</label>
                  <Input
                    placeholder="Observação do pagamento"
                    value={observacaoPagamento}
                    onChange={(e) => setObservacaoPagamento(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagamentos (apenas na edição) */}
        {despesa && (
          <PaymentsTabs
            tipo="despesa"
            entityId={despesa.id}
            contasBancarias={bancos}
            valorAberto={despesa.valor_aberto ?? despesa.valor}
          />
        )}
      </div>
    </DialogBase>
  );
}
