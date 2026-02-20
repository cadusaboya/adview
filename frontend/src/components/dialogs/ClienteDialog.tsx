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
import ComissaoList, { ComissaoItem } from "@/components/dialogs/ComissaoList";

import { Cliente, ClienteCreate, ClienteUpdate } from '@/types/clientes';
import { getFuncionarios } from '@/services/funcionarios';
import { Funcionario } from '@/types/funcionarios';
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
  const [comissoes, setComissoes] = useState<ComissaoItem[]>([]);

  // Load funcionários
  const {
    data: funcionarios,
  } = useLoadAuxiliaryData({
    loadFn: async () => {
      const response = await getFuncionarios({ page: 1, page_size: 1000 });
      return response.results.filter((f: Funcionario) => f.tipo === 'F' || f.tipo === 'P');
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar funcionários',
    cacheData: false,
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
      comissoes: [],
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
        comissoes: [],
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

      setComissoes(
        (cliente.comissoes || []).map((c) => ({
          id: String(c.id ?? crypto.randomUUID()),
          funcionario_id: c.funcionario_id,
          percentual: c.percentual,
        }))
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
        comissoes: [],
      });
      setFormas([]);
      setComissoes([]);
    }
  }, [cliente, open, setFormData]);

  const handleSubmitWrapper = async () => {
    const formasPayload = formas.map((f) => ({
      formato: f.formato,
      descricao: f.descricao,
      valor_mensal: f.formato === "M" ? f.valor : null,
      percentual_exito: f.formato === "E" ? f.valor : null,
    }));

    const comissoesPayload = comissoes
      .filter((c) => c.funcionario_id !== null && c.percentual !== '' && c.percentual !== 0)
      .map((c) => ({
        funcionario_id: c.funcionario_id as number,
        percentual: Number(c.percentual),
      }));

    await handleSubmit(async (data) => {
      try {
        const payload = {
          ...data,
          formas_cobranca: formasPayload,
          comissoes: comissoesPayload,
        };
        await onSubmit(payload);
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

        {/* Regras de comissão */}
        <ComissaoList
          comissoes={comissoes}
          setComissoes={setComissoes}
          funcionarios={funcionarios || []}
        />

        {/* Formas de cobrança */}
        <FormaCobrancaList formas={formas} setFormas={setFormas} />
      </div>
    </DialogBase>
  );
}
