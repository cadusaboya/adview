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
  ReceitaRecorrente,
  ReceitaRecorrenteCreate,
  ReceitaRecorrenteUpdate,
} from '@/types/receitasRecorrentes';
import { Cliente } from '@/types/clientes';
import { Funcionario } from '@/types/funcionarios';
import { getClientes } from '@/services/clientes';
import { getFuncionarios } from '@/services/funcionarios';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReceitaRecorrenteCreate | ReceitaRecorrenteUpdate) => Promise<void>;
  receita?: ReceitaRecorrente | null;
}

export default function ReceitaRecorrenteDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<ReceitaRecorrenteCreate>({
    nome: '',
    descricao: '',
    cliente_id: 0,
    valor: 0,
    tipo: 'F',
    forma_pagamento: null,
    comissionado_id: null,
    data_inicio: '',
    dia_vencimento: 1,
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  // ======================
  // 🔹 Load auxiliary data
  // ======================
  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientesRes, funcionariosRes] = await Promise.all([
          getClientes({ page_size: 1000 }),
          getFuncionarios({ page_size: 1000 }),
        ]);
        setClientes(clientesRes.results);
        setFuncionarios(funcionariosRes.results);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      }
    };
    loadData();
  }, []);

  // ======================
  // 🔄 Preencher ao editar
  // ======================
  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome,
        descricao: receita.descricao,
        cliente_id: receita.cliente?.id ?? receita.cliente_id,
        valor: receita.valor,
        tipo: receita.tipo,
        forma_pagamento: receita.forma_pagamento,
        comissionado_id: receita.comissionado?.id ?? null,
        data_inicio: receita.data_inicio,
        data_fim: receita.data_fim,
        dia_vencimento: receita.dia_vencimento,
        status: receita.status,
      });
      setValorDisplay(
        receita.valor ? formatCurrencyInput(receita.valor) : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: 0,
        valor: 0,
        tipo: 'F',
        forma_pagamento: null,
        comissionado_id: null,
        data_inicio: '',
        dia_vencimento: 1,
      });
      setValorDisplay('');
    }
  }, [receita, open]);

  // ======================
  // 💾 Submit
  // ======================
  const handleSubmit = async () => {
    // Validações
    if (!formData.nome || !formData.cliente_id || !formData.data_inicio) {
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
      title={receita ? 'Editar Receita Recorrente' : 'Nova Receita Recorrente'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Cliente *</label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um cliente"
              value={formData.cliente_id || undefined}
              options={clientes.map((c) => ({
                value: c.id,
                label: c.nome,
              }))}
              onChange={(val) =>
                setFormData({ ...formData, cliente_id: val ?? 0 })
              }
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nome da Receita *</label>
            <Input
              placeholder="Ex: Mensalidade Consultoria"
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
            placeholder="Detalhes sobre a receita recorrente"
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

        {/* Forma de Pagamento e Comissionado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div>
            <label className="text-sm font-medium">Comissionado (Opcional)</label>
            <AntdSelect
              allowClear
              placeholder="Selecione um funcionário/parceiro"
              value={formData.comissionado_id ?? undefined}
              options={funcionarios
                .filter((f) => f.tipo === 'F' || f.tipo === 'P')
                .map((f) => ({
                  value: f.id,
                  label: f.nome,
                }))}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  comissionado_id: val ?? null,
                })
              }
              style={{ width: '100%' }}
            />
          </div>
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
