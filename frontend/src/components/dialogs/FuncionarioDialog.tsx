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

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

import {
  Funcionario,
  FuncionarioCreate,
  FuncionarioUpdate,
} from '@/types/funcionarios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FuncionarioCreate | FuncionarioUpdate) => Promise<void>;
  funcionario?: Funcionario | null;
}

export default function FuncionarioDialog({
  open,
  onClose,
  onSubmit,
  funcionario,
}: Props) {
  const [formData, setFormData] = useState<FuncionarioCreate>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    aniversario: null,
    tipo: 'O',
    salario_mensal: null,
  });

  const [salarioDisplay, setSalarioDisplay] = useState('');

  // ======================
  // 🔄 LOAD (EDIT MODE)
  // ======================
  useEffect(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        email: funcionario.email,
        telefone: funcionario.telefone,
        aniversario: funcionario.aniversario,
        tipo: funcionario.tipo,
        salario_mensal:
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
        tipo: 'F',
        salario_mensal: null,
      });
      setSalarioDisplay('');
    }
  }, [funcionario, open]);

  // ======================
  // 💾 SUBMIT
  // ======================
  const handleSubmit = async () => {
    const payload = funcionario
      ? ({ ...formData } as FuncionarioUpdate)
      : ({ ...formData } as FuncionarioCreate);

    await onSubmit(payload);
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
        {/* Nome / CPF */}
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

        {/* Email / Telefone */}
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

        {/* Aniversário / Tipo */}
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
                setFormData({
                  ...formData,
                  tipo: val as FuncionarioCreate['tipo'],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Funcionário</SelectItem>
                <SelectItem value="P">Parceiro</SelectItem>
                <SelectItem value="C">Colaborador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Salário */}
        {formData.tipo === 'F' && (
          <div>
            <label className="text-sm">Salário Mensal</label>
            <Input
              placeholder="0,00"
              value={salarioDisplay}
              onChange={(e) => setSalarioDisplay(e.target.value)}
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
