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
import { Funcionario } from '@/services/funcionarios';
import { Fornecedor } from '@/services/fornecedores';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

/* =======================
   TYPES
======================= */

type TipoFuncionario = 'F' | 'P' | 'O' | 'C';

interface FuncionarioPayload {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aniversario: string | null;
  tipo: TipoFuncionario | '';
  salario_mensal: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FuncionarioPayload) => void;
  funcionario?: Funcionario | Fornecedor | null;
}

/* =======================
   COMPONENT
======================= */

export default function FuncionarioDialog({
  open,
  onClose,
  onSubmit,
  funcionario,
}: Props) {
  const [formData, setFormData] = useState<FuncionarioPayload>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    aniversario: null,
    tipo: '',
    salario_mensal: null,
  });

  const [salarioDisplay, setSalarioDisplay] = useState('');

  useEffect(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome || '',
        cpf: funcionario.cpf || '',
        email: funcionario.email || '',
        telefone: funcionario.telefone || '',
        aniversario: funcionario.aniversario || null,
        tipo: funcionario.tipo || '',
        salario_mensal:
          funcionario.salario_mensal !== undefined &&
          funcionario.salario_mensal !== null
            ? Number(funcionario.salario_mensal)
            : null,
      });

      setSalarioDisplay(
        funcionario.salario_mensal
          ? formatCurrencyInput(funcionario.salario_mensal)
          : ''
      );
    } else {
      setFormData({
        nome: '',
        cpf: '',
        email: '',
        telefone: '',
        aniversario: null,
        tipo: '',
        salario_mensal: null,
      });

      setSalarioDisplay('');
    }
  }, [funcionario, open]);

  const handleSubmit = () => {
    const payload: FuncionarioPayload = {
      ...formData,
      salario_mensal:
        formData.tipo === 'F' ? formData.salario_mensal : null,
      aniversario:
        formData.aniversario === '' ? null : formData.aniversario,
    };

    onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={funcionario ? 'Editar Funcionário' : 'Novo Funcionário'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Nome e CPF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Nome</label>
            <Input
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">CPF</label>
            <Input
              value={formData.cpf}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔸 Email e Telefone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Email</label>
            <Input
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Telefone</label>
            <Input
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔸 Aniversário e Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Data de Nascimento</label>
            <Input
              type="date"
              value={formData.aniversario ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  aniversario: e.target.value || null,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val as TipoFuncionario })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Funcionário</SelectItem>
                <SelectItem value="P">Parceiro</SelectItem>
                <SelectItem value="O">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Salário Mensal */}
        {formData.tipo === 'F' && (
          <div>
            <label className="text-sm">Salário Mensal (R$)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={salarioDisplay}
              onChange={(e) => setSalarioDisplay(e.target.value)}
              onFocus={() => {
                setSalarioDisplay(
                  salarioDisplay.replace(/[^\d,]/g, '')
                );
              }}
              onBlur={() => {
                const parsed = parseCurrencyBR(salarioDisplay);

                setSalarioDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );

                setFormData((prev) => ({
                  ...prev,
                  salario_mensal: parsed,
                }));
              }}
            />
          </div>
        )}
      </div>
    </DialogBase>
  );
}
