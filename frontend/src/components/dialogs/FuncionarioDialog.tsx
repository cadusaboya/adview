"use client";

import { useEffect, useState } from "react";
import DialogBase from "@/components/dialogs/DialogBase";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Funcionario } from "@/services/funcionarios";
import { Fornecedor } from "@/services/fornecedores";

export default function FuncionarioDialog({
  open,
  onClose,
  onSubmit,
  funcionario, // 🔥 Novo: recebe funcionario para edição
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  funcionario?: Funcionario | Fornecedor | null;
}) {
  const [formData, setFormData] = useState<any>({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    aniversario: "",
    tipo: "",
    salario_mensal: "",
  });

  useEffect(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome || "",
        cpf: funcionario.cpf || "",
        email: funcionario.email || "",
        telefone: funcionario.telefone || "",
        aniversario: funcionario.aniversario || "",
        tipo: funcionario.tipo || "",
        salario_mensal: funcionario.salario_mensal || "",
      });
    } else {
      setFormData({
        nome: "",
        cpf: "",
        email: "",
        telefone: "",
        aniversario: "",
        tipo: "",
        salario_mensal: "",
      });
    }
  }, [funcionario, open]);

  const handleSubmit = () => {
    const payload = {
      ...formData,
      salario_mensal: formData.tipo === "F" ? formData.salario_mensal : null,
      aniversario: formData.aniversario === "" ? null : formData.aniversario,
    };
    onSubmit(payload);
    onClose();
    setFormData({
      nome: "",
      cpf: "",
      email: "",
      telefone: "",
      aniversario: "",
      tipo: "",
      salario_mensal: "",
    });
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={funcionario ? "Editar Funcionário" : "Novo Funcionário"}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Nome e CPF */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Digite o nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">CPF</label>
            <Input
              placeholder="Digite o CPF"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
            />
          </div>
        </div>

        {/* 🔸 Email e Telefone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Email</label>
            <Input
              placeholder="Digite o email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">Telefone</label>
            <Input
              placeholder="Digite o telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
            />
          </div>
        </div>

        {/* 🔸 Aniversário e Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Data de Nascimento</label>
            <Input
              type="date"
              value={formData.aniversario}
              onChange={(e) => setFormData({ ...formData, aniversario: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData({ ...formData, tipo: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Funcionário</SelectItem>
                <SelectItem value="P">Parceiro</SelectItem>
                <SelectItem value="O">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Salário Mensal */}
        {formData.tipo === "F" && (
          <div>
            <label className="text-sm">Salário Mensal (R$)</label>
            <Input
              type="number"
              placeholder="Ex.: 3500"
              value={formData.salario_mensal}
              onChange={(e) =>
                setFormData({ ...formData, salario_mensal: e.target.value })
              }
            />
          </div>
        )}
      </div>
    </DialogBase>
  );
}
