'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import DialogBase from './DialogBase';
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
  DespesaRecorrente,
  DespesaRecorrenteCreate,
  DespesaRecorrenteUpdate,
} from '@/types/despesasRecorrentes';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DespesaRecorrenteCreate | DespesaRecorrenteUpdate) => Promise<void>;
  despesa?: DespesaRecorrente | null;
}

export default function DespesaRecorrenteDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  const [formData, setFormData] = useState<DespesaRecorrenteCreate>({
    nome: '',
    descricao: '',
    responsavel_id: 0,
    valor: 0,
    tipo: 'F',
    forma_pagamento: null,
    data_inicio: '',
    dia_vencimento: 1,
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);

  // ======================
  // 🔹 Favorecidos
  // ======================
  useEffect(() => {
    const loadFavorecidos = async () => {
      try {
        const { results } = await getFavorecidos({ page_size: 1000 });
        setFavorecidos(results);
      } catch (error) {
        console.error('Erro ao carregar favorecidos:', error);
      }
    };
    loadFavorecidos();
  }, []);

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
        tipo: despesa.tipo,
        forma_pagamento: despesa.forma_pagamento,
        data_inicio: despesa.data_inicio,
        data_fim: despesa.data_fim,
        dia_vencimento: despesa.dia_vencimento,
        status: despesa.status,
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
        tipo: 'F',
        forma_pagamento: null,
        data_inicio: '',
        dia_vencimento: 1,
      });
      setValorDisplay('');
    }
  }, [despesa, open]);

  // ======================
  // 💾 Submit
  // ======================
  const handleSubmit = async () => {
    // Validações
    if (!formData.nome || !formData.responsavel_id || !formData.data_inicio) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (formData.valor <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    if (formData.dia_vencimento < 1 || formData.dia_vencimento > 31) {
      toast.error('Dia de vencimento deve estar entre 1 e 31');
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={despesa ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Favorecido *</label>
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
                setFormData({ ...formData, responsavel_id: val ?? 0 })
              }
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nome da Despesa *</label>
            <Input
              placeholder="Ex: Aluguel do Escritório"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="text-sm font-medium">Descrição</label>
          <Input
            placeholder="Detalhes sobre a despesa recorrente"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* Valor, Tipo, Dia Vencimento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Valor (R$) *</label>
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

          <div>
            <label className="text-sm font-medium">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val as 'F' | 'V' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixa</SelectItem>
                <SelectItem value="V">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Dia de Vencimento *</label>
            <Input
              type="number"
              min="1"
              max="31"
              placeholder="1-31"
              value={formData.dia_vencimento}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dia_vencimento: parseInt(e.target.value) || 1,
                })
              }
            />
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div>
          <label className="text-sm font-medium">Forma de Pagamento</label>
          <Select
            value={formData.forma_pagamento || ''}
            onValueChange={(val) =>
              setFormData({
                ...formData,
                forma_pagamento: val ? (val as 'P' | 'B') : null,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P">Pix</SelectItem>
              <SelectItem value="B">Boleto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Início, Data Fim, Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Data de Início *</label>
            <Input
              type="date"
              value={formData.data_inicio}
              onChange={(e) =>
                setFormData({ ...formData, data_inicio: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Data de Fim (Opcional)</label>
            <Input
              type="date"
              value={formData.data_fim || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  data_fim: e.target.value || null,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Status</label>
            <Select
              value={formData.status || 'A'}
              onValueChange={(val) =>
                setFormData({ ...formData, status: val as 'A' | 'P' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Ativa</SelectItem>
                <SelectItem value="P">Pausada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </DialogBase>
  );
}
