'use client';

import DialogBase from "@/components/dialogs/DialogBase";
import { useEffect, useState } from "react";
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { clienteCreateSchema } from '@/lib/validation/schemas/cliente';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';

import FormaCobrancaList, {
  FormaCobrancaItem,
} from "@/components/dialogs/FormaCobrancaList";

import { Cliente, ClienteCreate, ClienteUpdate } from '@/types/clientes';
import { getFuncionarios } from '@/services/funcionarios';
import { formatCurrencyInput } from "@/lib/formatters";

interface ClienteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClienteCreate | ClienteUpdate) => Promise<void>;
  cliente?: Cliente | null;
}

export default function ClienteDialog({
  open,
  onClose,
  onSubmit,
  cliente,
}: ClienteDialogProps) {
  const [formas, setFormas] = useState<FormaCobrancaItem[]>([]);

  // Load funcionários
  const {
    data: funcionarios,
  } = useLoadAuxiliaryData({
    loadFn: async () => {
      const response = await getFuncionarios({ page: 1, page_size: 1000 });
      return response.results.filter((f: any) => f.tipo === 'F' || f.tipo === 'P');
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar funcionários',
  });

  // Form validation
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<ClienteCreate>(
    {
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      aniversario: null,
      tipo: "",
      formas_cobranca: [],
      comissionado_id: null,
    },
    clienteCreateSchema
  );

  // Initialize form when editing
  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome,
        cpf: cliente.cpf,
        email: cliente.email,
        telefone: cliente.telefone || "",
        aniversario: cliente.aniversario || null,
        tipo: cliente.tipo,
        formas_cobranca: [],
        comissionado_id: cliente.comissionado_id || null,
      });

      setFormas(
        (cliente.formas_cobranca || []).map((f) => {
          const formato =
            f.formato === "M" || f.formato === "E"
              ? f.formato
              : "M";

          const valor =
            formato === "M"
              ? Number(f.valor_mensal)
              : Number(f.percentual_exito);

          return {
            id: String(f.id),
            formato,
            descricao: f.descricao || "",
            valor,
            valor_display:
              formato === "M"
                ? valor
                  ? formatCurrencyInput(valor)
                  : ""
                : valor
                ? String(valor)
                : "",
          };
        })
      );
    } else {
      setFormData({
        nome: "",
        cpf: "",
        email: "",
        telefone: "",
        aniversario: null,
        tipo: "",
        formas_cobranca: [],
        comissionado_id: null,
      });
      setFormas([]);
    }
  }, [cliente, open, setFormData]);

  const handleSubmitWrapper = async () => {
    const formasPayload = formas.map((f) => ({
      formato: f.formato,
      descricao: f.descricao,
      valor_mensal: f.formato === "M" ? f.valor : null,
      percentual_exito: f.formato === "E" ? f.valor : null,
    }));

    await handleSubmit(async (data) => {
      try {
        const payload = {
          ...data,
          formas_cobranca: formasPayload,
        };
        await onSubmit(payload);
        onClose();
        toast.success(
          cliente ? 'Cliente atualizado com sucesso' : 'Cliente criado com sucesso'
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

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={cliente ? "Editar Cliente" : "Novo Cliente"}
      onSubmit={handleSubmitWrapper}
      loading={isSubmitting}
    >
      <div className="grid grid-cols-1 gap-6">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="CPF / CNPJ"
            placeholder="000.000.000-00"
            value={formData.cpf || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cpf: e.target.value }))
            }
            error={getFieldProps('cpf').error}
          />

          <div className="md:col-span-2">
            <FormInput
              label="Nome"
              required
              placeholder="Nome do cliente"
              value={formData.nome || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nome: e.target.value }))
              }
              error={getFieldProps('nome').error}
            />
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormInput
            label="Email"
            type="email"
            placeholder="email@exemplo.com"
            value={formData.email || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            error={getFieldProps('email').error}
          />

          <FormInput
            label="Telefone"
            placeholder="(00) 00000-0000"
            value={formData.telefone || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, telefone: e.target.value }))
            }
            error={getFieldProps('telefone').error}
          />

          <FormSelect
            label="Tipo de Cliente"
            required
            value={formData.tipo}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, tipo: val }))
            }
            options={[
              { value: 'F', label: 'Fixo' },
              { value: 'A', label: 'Avulso' },
            ]}
            placeholder="Selecione"
            error={getFieldProps('tipo').error}
          />

          <FormInput
            label="Data de Nascimento"
            type="date"
            value={formData.aniversario || ""}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                aniversario: e.target.value || null,
              }))
            }
            error={getFieldProps('aniversario').error}
          />
        </div>

        {/* Linha 3 - Comissionado */}
        <div className="grid grid-cols-1">
          <FormSelect
            label="Comissionado"
            value={formData.comissionado_id?.toString() || "none"}
            onValueChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                comissionado_id: val === "none" ? null : Number(val)
              }))
            }
            options={[
              { value: 'none', label: 'Nenhum' },
              ...(funcionarios?.map((f: any) => ({
                value: f.id.toString(),
                label: `${f.nome} (${f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})`
              })) || [])
            ]}
            placeholder="Nenhum"
            error={getFieldProps('comissionado_id').error}
          />
        </div>

        {/* Formas de cobrança */}
        <FormaCobrancaList formas={formas} setFormas={setFormas} />
      </div>
    </DialogBase>
  );
}
