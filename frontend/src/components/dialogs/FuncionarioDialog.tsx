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
import { Fornecedor } from '@/types/fornecedores';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FuncionarioCreate | FuncionarioUpdate) => Promise<void>;
  funcionario?: Funcionario | Fornecedor | null;
  mode?: 'funcionario' | 'fornecedor'; // Novo: define se é funcionário ou fornecedor
}

export default function FuncionarioDialog({
  open,
  onClose,
  onSubmit,
  funcionario,
  mode = 'funcionario', // Padrão: funcionário
}: Props) {
  const isFornecedor = mode === 'fornecedor';
  const [formData, setFormData] = useState<FuncionarioCreate>({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    aniversario: null,
    tipo: isFornecedor ? 'O' : 'F',
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
        tipo: isFornecedor ? 'O' : 'F',
        salario_mensal: null,
      });
      setSalarioDisplay('');
    }
  }, [funcionario, open, isFornecedor]);

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

  // Define título baseado no modo
  const getTitle = () => {
    if (isFornecedor) {
      return funcionario ? 'Editar Fornecedor' : 'Novo Fornecedor';
    }
    return funcionario ? 'Editar Funcionário' : 'Novo Funcionário';
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={getTitle()}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Nome / CPF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome completo"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">CPF</label>
            <Input
              placeholder="000.000.000-00"
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
              placeholder="email@exemplo.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Telefone</label>
            <Input
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            />
          </div>
        </div>

        {/* Aniversário / Tipo (ou só Aniversário para fornecedor) */}
        {isFornecedor ? (
          // Fornecedor: só mostra aniversário
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
        ) : (
          // Funcionário: mostra aniversário e tipo
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
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Salário (só para funcionários tipo F) */}
        {!isFornecedor && formData.tipo === 'F' && (
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
