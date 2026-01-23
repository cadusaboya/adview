'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
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
import { getFavorecidos, Favorecido } from '@/services/favorecidos';

import {
  Despesa,
  DespesaCreate,
  DespesaUpdate,
} from '@/types/despesas';

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

  // ======================
  // 🔄 Preencher ao editar
  // ======================
  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome,
        descricao: despesa.descricao,
        responsavel_id: despesa.responsavel_id,
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
      const payload: DespesaCreate = { ...formData };
      await onSubmit(payload);
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
              getPopupContainer={(trigger) => trigger.parentElement!}
            />
          </div>

          <div>
            <label className="text-sm">Nome</label>
            <Input
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

        {/* Pagamentos */}
        {despesa && (
          <PaymentsTabs
            tipo="despesa"
            entityId={despesa.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
