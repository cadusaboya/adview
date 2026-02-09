import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "antd";
import { Transfer, TransferCreate, TransferUpdate } from "@/types/transfer";
import { getBancos } from "@/services/bancos";
import { toast } from "sonner";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useLoadAuxiliaryData } from "@/hooks/useLoadAuxiliaryData";
import { transferCreateSchema } from "@/lib/validation/schemas/transfer";
import { FormInput } from "@/components/form/FormInput";
import { FormSelect } from "@/components/form/FormSelect";
import { FormTextarea } from "@/components/form/FormTextarea";
import { applyBackendErrors } from "@/lib/validation/backendErrors";
import { formatCurrencyInput, parseCurrencyBR } from "@/lib/formatters";

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TransferCreate | TransferUpdate) => Promise<void>;
  transfer?: Transfer | null;
}

export default function TransferDialog({ open, onClose, onSubmit, transfer }: TransferDialogProps) {
  const [valorDisplay, setValorDisplay] = useState('');

  // Load bancos with new hook
  const {
    data: bancos,
    loading: loadingBancos,
  } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getBancos({ page_size: 1000 });
      return res.results;
    },
    onOpen: open,
    errorMessage: "Erro ao carregar contas bancárias",
  });

  // Form validation with new hook
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<TransferCreate>(
    {
      from_bank_id: 0,
      to_bank_id: 0,
      valor: "",
      data_transferencia: new Date().toISOString().split("T")[0],
      descricao: "",
    },
    transferCreateSchema
  );

  // Initialize form with transfer data when editing
  useEffect(() => {
    if (transfer) {
      setFormData({
        from_bank_id: transfer.from_bank,
        to_bank_id: transfer.to_bank,
        valor: transfer.valor,
        data_transferencia: transfer.data_transferencia,
        descricao: transfer.descricao || "",
      });
      setValorDisplay(formatCurrencyInput(parseFloat(transfer.valor) || 0));
    } else {
      setFormData({
        from_bank_id: 0,
        to_bank_id: 0,
        valor: "",
        data_transferencia: new Date().toISOString().split("T")[0],
        descricao: "",
      });
      setValorDisplay('');
    }
  }, [transfer, setFormData]);

  const onSubmitHandler = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    await handleSubmit(async (data) => {
      try {
        await onSubmit(data);
        onClose();
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) {
          toast.error(generalError);
        }
        throw error; // Re-throw to keep isSubmitting state
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {transfer ? "Editar Transferência" : "Nova Transferência"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmitHandler} className="space-y-4">
          {/* Banco de Origem */}
          <FormSelect
            label="Banco de Origem"
            required
            value={String(formData.from_bank_id)}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, from_bank_id: parseInt(val) }))
            }
            options={
              bancos?.map((b) => ({
                value: String(b.id),
                label: b.nome,
              })) || []
            }
            disabled={loadingBancos}
            placeholder="Selecione o banco de origem"
            error={getFieldProps("from_bank_id").error}
          />

          {/* Banco de Destino */}
          <FormSelect
            label="Banco de Destino"
            required
            value={String(formData.to_bank_id)}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, to_bank_id: parseInt(val) }))
            }
            options={
              bancos?.map((b) => ({
                value: String(b.id),
                label: b.nome,
              })) || []
            }
            disabled={loadingBancos}
            placeholder="Selecione o banco de destino"
            error={getFieldProps("to_bank_id").error}
          />

          {/* Valor */}
          <FormInput
            label="Valor (R$)"
            required
            placeholder="0,00"
            value={valorDisplay}
            onChange={(e) => setValorDisplay(e.target.value)}
            onBlur={() => {
              const parsed = parseCurrencyBR(valorDisplay);
              setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
              setFormData((prev) => ({ ...prev, valor: String(parsed || 0) }));
            }}
            error={getFieldProps("valor").error}
          />

          {/* Data */}
          <FormInput
            type="date"
            label="Data da Transferência"
            required
            value={formData.data_transferencia}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, data_transferencia: e.target.value }))
            }
            error={getFieldProps("data_transferencia").error}
          />

          {/* Descrição */}
          <FormTextarea
            label="Descrição"
            value={formData.descricao || ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData((prev) => ({ ...prev, descricao: e.target.value }))
            }
            rows={3}
            placeholder="Descrição opcional da transferência"
            error={getFieldProps("descricao").error}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              className="bg-navy hover:bg-navy/90"
            >
              {transfer ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
