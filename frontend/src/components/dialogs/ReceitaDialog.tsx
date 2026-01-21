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
import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';
import { getFuncionarios } from '@/services/funcionarios';
import { getClientes } from '@/services/clientes';

/* =======================
   TYPES
======================= */

interface ReceitaPayload {
  nome: string;
  descricao?: string;
  cliente_id: string;
  valor: number | '';
  data_vencimento: string;
  tipo: string;
  forma_pagamento: string;
  comissionado_id: string;
}

interface ReceitaDTO extends ReceitaPayload {
  id: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReceitaPayload) => Promise<void>;
  receita?: ReceitaDTO | null;
}

/* =======================
   COMPONENT
======================= */

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<ReceitaPayload>({
    nome: '',
    descricao: '',
    cliente_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
    forma_pagamento: '',
    comissionado_id: '',
  });

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [valorDisplay, setValorDisplay] = useState('');

  /* 🔹 Preencher formulário ao editar */
  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome || '',
        descricao: receita.descricao || '',
        cliente_id: receita.cliente_id ? String(receita.cliente_id) : '',
        valor: receita.valor || '',
        data_vencimento: receita.data_vencimento || '',
        tipo: receita.tipo || '',
        forma_pagamento: receita.forma_pagamento || '',
        comissionado_id: receita.comissionado_id
          ? String(receita.comissionado_id)
          : '',
      });

      setValorDisplay(
        receita.valor ? formatCurrencyInput(receita.valor) : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
        forma_pagamento: '',
        comissionado_id: '',
      });
      setValorDisplay('');
    }
  }, [receita, open]);

  /* 🔹 Carregar bancos */
  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 });
      setBancos(results.map((b) => ({ id: b.id, nome: b.nome })));
    };
    loadBancos();
  }, []);

  /* 🔹 Carregar funcionários */
  useEffect(() => {
    const loadFuncionarios = async () => {
      const { results } = await getFuncionarios({ page_size: 1000 });
      setFuncionarios(results);
    };
    loadFuncionarios();
  }, []);

  /* 🔹 Carregar clientes */
  useEffect(() => {
    const loadClientes = async () => {
      const { results } = await getClientes({ page_size: 1000 });
      setClientes(results);
    };
    loadClientes();
  }, []);

  const handleSubmit = async () => {
    const payload: ReceitaPayload = { ...formData };
    await onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={receita ? 'Editar Receita' : 'Nova Receita'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Cliente</label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um cliente"
              value={formData.cliente_id || undefined}
              style={{ width: '100%' }}
              optionFilterProp="label"
              options={clientes.map((c) => ({
                value: String(c.id),
                label: c.nome,
              }))}
              onChange={(val) =>
                setFormData({ ...formData, cliente_id: val || '' })
              }
              popupClassName="antd-select-popup-dialog"
              getPopupContainer={(trigger) =>
                trigger.closest('[role="dialog"]') || document.body
              }
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

        {/* 🔸 Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* 🔸 Valor + Vencimento + Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
                setFormData({ ...formData, valor: parsed });
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
                setFormData({ ...formData, tipo: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixa</SelectItem>
                <SelectItem value="V">Variável</SelectItem>
                <SelectItem value="E">Estorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔸 Forma Pgto + Comissionado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Forma de Pagamento</label>
            <Select
              value={formData.forma_pagamento}
              onValueChange={(val) =>
                setFormData({ ...formData, forma_pagamento: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">Pix</SelectItem>
                <SelectItem value="B">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm">Comissionado (opcional)</label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um funcionário"
              value={formData.comissionado_id || undefined}
              style={{ width: '100%' }}
              options={funcionarios.map((f) => ({
                value: String(f.id),
                label: f.nome,
              }))}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  comissionado_id: val || '',
                })
              }
              popupClassName="antd-select-popup-dialog"
              getPopupContainer={(trigger) =>
                trigger.closest('[role="dialog"]') || document.body
              }
            />
          </div>
        </div>

        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos}
          />
        )}
      </div>

      <style jsx global>{`
        .antd-select-popup-dialog {
          z-index: 9999 !important;
        }
        .ant-select-dropdown {
          z-index: 9999 !important;
        }
      `}</style>
    </DialogBase>
  );
}
