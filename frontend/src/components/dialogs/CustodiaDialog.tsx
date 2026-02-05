'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
import { Select as AntdSelect } from 'antd';

import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getFuncionarios } from '@/services/funcionarios';
import { getClientes } from '@/services/clientes';
import { getBancos } from '@/services/bancos';

import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';
import {
  Custodia,
  CustodiaCreate,
  CustodiaUpdate,
} from '@/types/custodias';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CustodiaCreate | CustodiaUpdate) => Promise<void>;
  custodia?: Custodia | null;
  tipo: 'P' | 'A'; // P = Passivo, A = Ativo (vem da página)
}

export default function CustodiaDialog({
  open,
  onClose,
  onSubmit,
  custodia,
  tipo,
}: Props) {
  const [formData, setFormData] = useState<Omit<CustodiaCreate, 'tipo'>>({
    nome: '',
    descricao: '',
    cliente_id: null,
    funcionario_id: null,
    valor_total: 0,
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [pessoaTipo, setPessoaTipo] = useState<'cliente' | 'funcionario' | null>(null);

  // ======================
  // 🔄 LOAD EDIT
  // ======================
  useEffect(() => {
    if (custodia) {
      setFormData({
        nome: custodia.nome,
        descricao: custodia.descricao,
        cliente_id: custodia.cliente?.id ?? null,
        funcionario_id: custodia.funcionario?.id ?? null,
        valor_total: custodia.valor_total,
      });

      setValorDisplay(formatCurrencyInput(custodia.valor_total));

      // Determinar tipo de pessoa
      if (custodia.cliente) {
        setPessoaTipo('cliente');
      } else if (custodia.funcionario) {
        setPessoaTipo('funcionario');
      }
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: null,
        funcionario_id: null,
        valor_total: 0,
      });
      setValorDisplay('');
      setPessoaTipo(null);
    }
  }, [custodia, open]);

  // ======================
  // 🔹 LOAD AUX
  // ======================
  useEffect(() => {
    getFuncionarios({ page_size: 1000 }).then((res) =>
      setFuncionarios(res.results)
    );
    getClientes({ page_size: 1000 }).then((res) =>
      setClientes(res.results)
    );
    getBancos({ page_size: 1000 }).then((res) =>
      setBancos(res.results.map((b) => ({ id: b.id, nome: b.nome })))
    );
  }, []);

  // ======================
  // 💾 SUBMIT
  // ======================
  const handleSubmit = async () => {
    const payload: CustodiaCreate | CustodiaUpdate = {
      ...formData,
      tipo, // Usa o tipo recebido da página
    };

    // Limpar o campo que não está sendo usado
    if (pessoaTipo === 'cliente') {
      payload.funcionario_id = null;
    } else if (pessoaTipo === 'funcionario') {
      payload.cliente_id = null;
    }

    await onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={custodia ? 'Editar Custódia' : 'Criar Custódia'}
      submitLabel={custodia ? 'Salvar' : 'Criar'}
    >
      <div className="space-y-4">
        {/* Nome e Valor Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nome *</label>
            <Input
              placeholder="Digite o nome da custódia"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Valor Total *</label>
            <Input
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
                setFormData((prev) => ({ ...prev, valor_total: parsed }));
              }}
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium mb-2">Descrição</label>
          <Input
            placeholder="Digite uma descrição (opcional)"
            value={formData.descricao ?? ''}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* Tipo de Pessoa e Seleção */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Pessoa *</label>
            <AntdSelect
              placeholder="Selecione o tipo de pessoa"
              value={pessoaTipo}
              onChange={(value) => {
                setPessoaTipo(value);
                // Limpar seleções anteriores
                setFormData({
                  ...formData,
                  cliente_id: null,
                  funcionario_id: null,
                });
              }}
              style={{ width: '100%' }}
              options={[
                { value: 'cliente', label: 'Cliente' },
                { value: 'funcionario', label: 'Funcionário/Fornecedor/Parceiro' },
              ]}
            />
          </div>

          {/* Cliente */}
          {pessoaTipo === 'cliente' && (
            <div>
              <label className="block text-sm font-medium mb-2">Cliente *</label>
              <AntdSelect
                showSearch
                placeholder="Selecione o cliente"
                value={formData.cliente_id}
                onChange={(value) =>
                  setFormData({ ...formData, cliente_id: value })
                }
                style={{ width: '100%' }}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={clientes.map((c) => ({
                  value: c.id,
                  label: c.nome,
                }))}
              />
            </div>
          )}

          {/* Funcionário */}
          {pessoaTipo === 'funcionario' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Funcionário/Fornecedor/Parceiro *
              </label>
              <AntdSelect
                showSearch
                placeholder="Selecione o funcionário"
                value={formData.funcionario_id}
                onChange={(value) =>
                  setFormData({ ...formData, funcionario_id: value })
                }
                style={{ width: '100%' }}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={funcionarios.map((f) => ({
                  value: f.id,
                  label: f.nome,
                }))}
              />
            </div>
          )}
        </div>

        {/* Pagamentos (apenas na edição) */}
        {custodia && (
          <PaymentsTabs
            tipo="custodia"
            entityId={custodia.id}
            contasBancarias={bancos}
            custodiaTipo={custodia.tipo}
            valorAberto={custodia.valor_total - custodia.valor_liquidado}
          />
        )}
      </div>
    </DialogBase>
  );
}
