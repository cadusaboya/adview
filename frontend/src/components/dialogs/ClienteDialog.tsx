import DialogBase from "@/components/dialogs/DialogBase";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import FormaCobrancaList, { FormaCobrancaItem } from "@/components/dialogs/FormaCobrancaList";
import { Cliente } from "@/services/clientes";

export default function ClienteDialog({
  open,
  onClose,
  onSubmit,
  cliente, // 🔥 Cliente para edição (ou null para criar)
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

  // 🔥 Preenche os campos quando recebe um cliente para edição
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
        (cliente.formas_cobranca || []).map((f) => ({
          id: String(f.id),
          formato: f.formato,
          descricao: f.descricao,
          valor: f.formato === "M" ? f.valor_mensal || "" : f.percentual_exito || "",
        }))
      );
    } else {
      // Se não há cliente, limpa os campos (para criação)
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

  const handleSubmit = () => {
    const payload = {
      ...formData,
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
          <div className="space-y-1">
            <label className="text-sm font-medium block">CPF / CNPJ</label>
            <Input
              placeholder="Digite o CPF ou CNPJ"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium block">Nome</label>
            <Input
              placeholder="Digite o nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
        </div>

        {/* 🔹 Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium block">Email</label>
            <Input
              placeholder="Digite o email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium block">Telefone</label>
            <Input
              placeholder="Digite o telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium block">Tipo de Cliente</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData({ ...formData, tipo: val })}
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

          <div className="space-y-1">
            <label className="text-sm font-medium block">Data de Nascimento</label>
            <Input
              type="date"
              placeholder="Data de Nascimento"
              value={formData.aniversario}
              onChange={(e) => setFormData({ ...formData, aniversario: e.target.value })}
            />
          </div>
        </div>

        {/* 🔥 Formas de cobrança */}
        <div>
          <FormaCobrancaList formas={formas} setFormas={setFormas} />
        </div>
      </div>
    </DialogBase>
  );
}
