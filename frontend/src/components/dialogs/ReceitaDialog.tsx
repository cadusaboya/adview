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
import { Button } from '@/components/ui/button';

import { Select as AntdSelect } from 'antd';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';

import { getBancos } from '@/services/bancos';
import { getFuncionarios, Funcionario } from '@/services/funcionarios';
import { getClientes, Cliente } from '@/services/clientes';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  receita?: any | null;
}

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<any>({
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
      setBancos(results.map((banco) => ({ id: banco.id, nome: banco.nome })));
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
    const payload = { ...formData };
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
              listHeight={256}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={clientes.map((c) => ({
                value: String(c.id),
                label: c.nome,
              }))}
              onChange={(val) =>
                setFormData({ ...formData, cliente_id: val || '' })
              }
              // 🔥 FIX: Adicionar popupClassName para corrigir z-index
              popupClassName="antd-select-popup-dialog"
              // 🔥 FIX: Usar getPopupContainer para renderizar dentro do dialog
              getPopupContainer={(trigger) => {
                const dialogParent = trigger.closest('[role="dialog"]');
                return dialogParent || document.body;
              }}
            />
          </div>

          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome"
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
            placeholder="Observações ou descrição"
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
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onFocus={() => {
                setValorDisplay(valorDisplay.replace(/[^\d,]/g, ''));
              }}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );
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
              listHeight={256}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={[
                { value: '', label: 'Nenhum' },
                ...funcionarios.map((f) => ({
                  value: String(f.id),
                  label: f.nome,
                })),
              ]}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  comissionado_id: val || '',
                })
              }
              // 🔥 FIX: Adicionar popupClassName para corrigir z-index
              popupClassName="antd-select-popup-dialog"
              // 🔥 FIX: Usar getPopupContainer para renderizar dentro do dialog
              getPopupContainer={(trigger) => {
                const dialogParent = trigger.closest('[role="dialog"]');
                return dialogParent || document.body;
              }}
            />
          </div>
        </div>

        {/* 🔥 Pagamentos */}
        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos}
          />
        )}
      </div>

      {/* 🔥 CSS para corrigir z-index do Ant Design Select dentro do Dialog */}
      <style jsx global>{`
        .antd-select-popup-dialog {
          z-index: 9999 !important;
        }
        
        /* Garantir que o dropdown do Ant Design fique acima do dialog */
        .ant-select-dropdown {
          z-index: 9999 !important;
        }
      `}</style>
    </DialogBase>
  );
}
