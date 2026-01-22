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

import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';

import { getBancos } from '@/services/bancos';
import { getFuncionarios } from '@/services/funcionarios';
import { getClientes } from '@/services/clientes';

import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';
import {
  Receita,
  ReceitaCreate,
  ReceitaUpdate,
} from '@/types/receitas';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReceitaCreate | ReceitaUpdate) => Promise<void>;
  receita?: Receita | null;
}

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<ReceitaCreate>({
    nome: '',
    descricao: '',
    cliente_id: 0,
    valor: 0,
    data_vencimento: '',
    tipo: 'F',
    forma_pagamento: 'P',
    comissionado_id: null,
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // ======================
  // 🔄 LOAD EDIT
  // ======================
  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome,
        descricao: receita.descricao,
        cliente_id: receita.cliente?.id ?? receita.cliente_id!,
        valor: receita.valor,
        data_vencimento: receita.data_vencimento,
        tipo: receita.tipo,
        forma_pagamento: receita.forma_pagamento ?? 'P',
        comissionado_id: receita.comissionado?.id ?? null,
      });

      setValorDisplay(formatCurrencyInput(receita.valor));
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: 0,
        valor: 0,
        data_vencimento: '',
        tipo: 'F',
        forma_pagamento: 'P',
        comissionado_id: null,
      });
      setValorDisplay('');
    }
  }, [receita, open]);

  // ======================
  // 🔹 LOAD AUX
  // ======================
  useEffect(() => {
    getBancos({ page_size: 1000 }).then((res) =>
      setBancos(res.results.map((b) => ({ id: b.id, nome: b.nome })))
    );
    getFuncionarios({ page_size: 1000 }).then((res) =>
      setFuncionarios(res.results)
    );
    getClientes({ page_size: 1000 }).then((res) =>
      setClientes(res.results)
    );
  }, []);

  // ======================
  // 💾 SUBMIT
  // ======================
  const handleSubmit = async () => {
    const payload = receita
      ? ({ ...formData } as ReceitaUpdate)
      : ({ ...formData } as ReceitaCreate);

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
        {/* Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AntdSelect
            showSearch
            placeholder="Cliente"
            value={formData.cliente_id || undefined}
            options={clientes.map((c) => ({
              value: c.id,
              label: c.nome,
            }))}
            onChange={(val) =>
              setFormData({ ...formData, cliente_id: val })
            }
            style={{ width: '100%' }}
          />

          <Input
            placeholder="Nome"
            value={formData.nome}
            onChange={(e) =>
              setFormData({ ...formData, nome: e.target.value })
            }
          />
        </div>

        {/* Valor / Data / Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Valor"
            value={valorDisplay}
            onChange={(e) => setValorDisplay(e.target.value)}
            onBlur={() => {
              const parsed = parseCurrencyBR(valorDisplay);
              setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
              setFormData((prev) => ({ ...prev, valor: parsed }));
            }}
          />

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

          <Select
            value={formData.tipo}
            onValueChange={(val) =>
              setFormData({ ...formData, tipo: val as ReceitaCreate['tipo'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="F">Fixa</SelectItem>
              <SelectItem value="V">Variável</SelectItem>
              <SelectItem value="E">Estorno</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Forma / Comissionado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            value={formData.forma_pagamento}
            onValueChange={(val) =>
              setFormData({
                ...formData,
                forma_pagamento: val as ReceitaCreate['forma_pagamento'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P">Pix</SelectItem>
              <SelectItem value="B">Boleto</SelectItem>
            </SelectContent>
          </Select>

          <AntdSelect
            allowClear
            placeholder="Comissionado"
            value={formData.comissionado_id ?? undefined}
            options={funcionarios.map((f) => ({
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

        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
