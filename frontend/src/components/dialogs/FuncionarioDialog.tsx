'use client';

import { useEffect } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { funcionarioCreateSchema } from '@/lib/validation/schemas/funcionario';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';

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
  mode?: 'funcionario' | 'fornecedor';
}

export default function FuncionarioDialog({
  open,
  onClose,
  onSubmit,
  funcionario,
  mode = 'funcionario',
}: Props) {
  const isFornecedor = mode === 'fornecedor';

  // Form validation with new hook
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<FuncionarioCreate>(
    {
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      aniversario: null,
      tipo: isFornecedor ? 'O' : 'F',
      salario_mensal: null,
    },
    funcionarioCreateSchema
  );

  // Initialize form when editing
  useEffect(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome,
        cpf: funcionario.cpf || '',
        email: funcionario.email || '',
        telefone: funcionario.telefone || '',
        aniversario: funcionario.aniversario,
        tipo: funcionario.tipo,
        salario_mensal:
          funcionario.salario_mensal !== null
            ? Number(funcionario.salario_mensal)
            : null,
      });
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
    }
  }, [funcionario, open, isFornecedor, setFormData]);

  const handleSubmitWrapper = async () => {
    await handleSubmit(async (data) => {
      try {
        await onSubmit(data);
        onClose();
        const entityName = isFornecedor ? 'Fornecedor' : 'Funcionário';
        toast.success(
          funcionario
            ? `${entityName} atualizado com sucesso`
            : `${entityName} criado com sucesso`
        );
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) {
          toast.error(generalError);
        }
        throw error;
      }
    });
  };

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
      onSubmit={handleSubmitWrapper}
      loading={isSubmitting}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Nome / CPF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nome"
            required
            placeholder="Nome completo"
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            error={getFieldProps('nome').error}
          />

          <FormInput
            label="CPF"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cpf: e.target.value }))
            }
            error={getFieldProps('cpf').error}
          />
        </div>

        {/* Email / Telefone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Email"
            type="email"
            placeholder="email@exemplo.com"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            error={getFieldProps('email').error}
          />

          <FormInput
            label="Telefone"
            placeholder="(00) 00000-0000"
            value={formData.telefone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, telefone: e.target.value }))
            }
            error={getFieldProps('telefone').error}
          />
        </div>

        {/* Aniversário / Tipo (ou só Aniversário para fornecedor) */}
        {isFornecedor ? (
          <FormInput
            label="Data de Nascimento"
            type="date"
            value={formData.aniversario || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                aniversario: e.target.value || null,
              }))
            }
            error={getFieldProps('aniversario').error}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Data de Nascimento"
              type="date"
              value={formData.aniversario || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  aniversario: e.target.value || null,
                }))
              }
              error={getFieldProps('aniversario').error}
            />

            <FormSelect
              label="Tipo"
              required
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  tipo: val as FuncionarioCreate['tipo'],
                }))
              }
              options={[
                { value: 'F', label: 'Funcionário' },
                { value: 'P', label: 'Parceiro' },
              ]}
              placeholder="Selecione"
              error={getFieldProps('tipo').error}
            />
          </div>
        )}

        {/* Salário (só para funcionários tipo F) */}
        {!isFornecedor && formData.tipo === 'F' && (
          <FormInput
            label="Salário Mensal"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.salario_mensal || ''}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                salario_mensal: parseFloat(e.target.value) || null,
              }))
            }
            error={getFieldProps('salario_mensal').error}
          />
        )}
      </div>
    </DialogBase>
  );
}
