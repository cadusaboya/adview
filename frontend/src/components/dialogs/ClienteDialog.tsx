'use client';

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

import { Cliente, ClienteCreate, ClienteUpdate } from '@/types/clientes';
import { getFuncionarios } from '@/services/funcionarios';

import { formatCurrencyInput } from "@/lib/formatters";

interface ClienteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ClienteCreate | ClienteUpdate) => void;
  cliente?: Cliente | null;
}

export default function ClienteDialog({
  open,
  onClose,
  onSubmit,
  cliente,
}: ClienteDialogProps) {
  // 🔹 Form SEMPRE baseado em ClienteCreate
  const [formData, setFormData] = useState<ClienteCreate>({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    aniversario: null,
    tipo: "",
    formas_cobranca: [],
    comissionado_id: null,
  });

  const [formas, setFormas] = useState<FormaCobrancaItem[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  // ======================
  // 🔄 Buscar funcionários
  // ======================
  useEffect(() => {
    const loadFuncionarios = async () => {
      try {
        const response = await getFuncionarios({ page: 1, page_size: 1000 });
        // Filtrar apenas Funcionários (F) e Parceiros (P)
        const filtered = response.results.filter((f: any) => f.tipo === 'F' || f.tipo === 'P');
        setFuncionarios(filtered);
      } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
      }
    };

    if (open) {
      loadFuncionarios();
    }
  }, [open]);

  // ======================
  // 🔄 Preencher ao editar
  // ======================
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
              : "M"; // fallback seguro
      
          const valor =
            formato === "M"
              ? Number(f.valor_mensal)
              : Number(f.percentual_exito);
      
          return {
            id: String(f.id),
            formato, // ✅ agora é "M" | "E"
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
  }, [cliente, open]);

  // ======================
  // 💾 Submit
  // ======================
  const handleSubmit = () => {
    const formasPayload = formas.map((f) => ({
      formato: f.formato,
      descricao: f.descricao,
      valor_mensal: f.formato === "M" ? f.valor : null,
      percentual_exito: f.formato === "E" ? f.valor : null,
    }));

    if (cliente) {
      const payload: ClienteUpdate = {
        ...formData,
        formas_cobranca: formasPayload,
      };
      onSubmit(payload);
    } else {
      const payload: ClienteCreate = {
        ...formData,
        formas_cobranca: formasPayload,
      };
      onSubmit(payload);
    }

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
              placeholder="000.000.000-00"
              value={formData.cpf || ""}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              placeholder="Nome do cliente"
              value={formData.nome || ""}
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
              placeholder="email@exemplo.com"
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Telefone</label>
            <Input
              placeholder="(00) 00000-0000"
              value={formData.telefone || ""}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tipo de Cliente *</label>
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
              value={formData.aniversario || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  aniversario: e.target.value || null,
                })
              }
            />
          </div>
        </div>

        {/* 🔹 Linha 3 - Comissionado */}
        <div className="grid grid-cols-1">
          <div>
            <label className="text-sm font-medium">Comissionado</label>
            <Select
              value={formData.comissionado_id?.toString() || "none"}
              onValueChange={(val) =>
                setFormData({
                  ...formData,
                  comissionado_id: val === "none" ? null : Number(val)
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {funcionarios.map((f) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.nome} ({f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Formas de cobrança */}
        <FormaCobrancaList formas={formas} setFormas={setFormas} />
      </div>
    </DialogBase>
  );
}
