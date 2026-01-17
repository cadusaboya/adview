import DialogBase from "@/components/dialogs/DialogBase";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import FormaCobrancaList, {
  FormaCobrancaItem,
} from "@/components/dialogs/FormaCobrancaList";
import { Cliente } from "@/services/clientes";
import { formatCurrencyInput } from "@/lib/formatters";

export default function ClienteDialog({
  open,
  onClose,
  onSubmit,
  cliente,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  cliente?: Cliente | null;
}) {
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    aniversario: "",
    tipo: "",
  });

  const [formas, setFormas] = useState<FormaCobrancaItem[]>([]);

  /* 🔹 Preencher formulário ao editar */
  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || "",
        cpf: cliente.cpf || "",
        email: cliente.email || "",
        telefone: cliente.telefone || "",
        aniversario: cliente.aniversario || "",
        tipo: cliente.tipo || "",
      });

      setFormas(
        (cliente.formas_cobranca || []).map((f) => {
          const valor =
            f.formato === "M"
              ? Number(f.valor_mensal)
              : Number(f.percentual_exito);

          return {
            id: String(f.id),
            formato: f.formato,
            descricao: f.descricao || "",
            valor,
            valor_display:
              f.formato === "M"
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
        aniversario: "",
        tipo: "",
      });
      setFormas([]);
    }
  }, [cliente, open]);

  /* 🔹 Submit */
  const handleSubmit = () => {
    const payload = {
      ...formData,
      aniversario: formData.aniversario || null,
      formas_cobranca: formas.map((f) => ({
        formato: f.formato,
        descricao: f.descricao,
        valor_mensal: f.formato === "M" ? f.valor : null,
        percentual_exito: f.formato === "E" ? f.valor : null,
      })),
    };

    onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={cliente ? "Editar Cliente" : "Novo Cliente"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-6">
        {/* 🔹 Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">CPF / CNPJ</label>
            <Input
              value={formData.cpf}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔹 Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Telefone</label>
            <Input
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tipo de Cliente</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixo</SelectItem>
                <SelectItem value="A">Avulso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Data de Nascimento</label>
            <Input
              type="date"
              value={formData.aniversario}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  aniversario: e.target.value,
                })
              }
            />
          </div>
        </div>

        {/* 🔥 Formas de cobrança */}
        <FormaCobrancaList formas={formas} setFormas={setFormas} />
      </div>
    </DialogBase>
  );
}
