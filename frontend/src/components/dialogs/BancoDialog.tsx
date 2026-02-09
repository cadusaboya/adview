'use client';

import DialogBase from '@/components/dialogs/DialogBase';
import { useEffect } from 'react';
import { Banco, BancoCreate, BancoUpdate } from '@/types/bancos';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { bancoCreateSchema } from '@/lib/validation/schemas/banco';
import { FormInput } from '@/components/form/FormInput';
import { applyBackendErrors } from '@/lib/validation/backendErrors';

interface BancoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BancoCreate | BancoUpdate) => Promise<void>;
  banco?: Banco | null;
}

export default function BancoDialog({
  open,
  onClose,
  onSubmit,
  banco,
}: BancoDialogProps) {
  // Form validation with new hook
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<BancoCreate>(
    {
      nome: '',
      descricao: '',
      saldo_atual: 0,
    },
    bancoCreateSchema
  );

  // Initialize form with banco data when editing
  useEffect(() => {
    if (banco) {
      setFormData({
        nome: banco.nome,
        descricao: banco.descricao,
        saldo_atual: banco.saldo_atual,
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        saldo_atual: 0,
      });
    }
  }, [banco, open, setFormData]);

  const handleSubmitWrapper = async () => {
    await handleSubmit(async (data) => {
      try {
        await onSubmit(data);
        onClose();
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) {
          toast.error(generalError);
        }
        throw error;
      }
    });
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={banco ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
      onSubmit={handleSubmitWrapper}
      loading={isSubmitting}
    >
      <div className="grid grid-cols-1 gap-6">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nome da Conta"
            required
            placeholder="Ex.: Itaú PJ, Nubank, Caixa"
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            error={getFieldProps('nome').error}
          />

          <FormInput
            label="Saldo Atual"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.saldo_atual}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, saldo_atual: parseFloat(e.target.value) || 0 }))
            }
            error={getFieldProps('saldo_atual').error}
          />
        </div>

        {/* Linha 2 */}
        <FormInput
          label="Descrição"
          placeholder="Ex.: Conta PJ usada para despesas fixas"
          value={formData.descricao}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, descricao: e.target.value }))
          }
          error={getFieldProps('descricao').error}
        />
      </div>
    </DialogBase>
  );
}
