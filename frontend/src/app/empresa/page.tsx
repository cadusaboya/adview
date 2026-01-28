"use client";

import { useEffect, useState, useCallback } from "react";
import { getMyEmpresa, updateMyEmpresa } from "@/services/empresa";
import { Empresa, EmpresaUpdate } from "@/types/empresa";
import { Button } from "antd";
import { toast } from "sonner";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import { Input } from "@/components/ui/input";

export default function EmpresaPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<EmpresaUpdate>({
    name: "",
    cnpj: "",
    cpf: "",
    endereco: "",
    cidade: "",
    estado: "",
    telefone: "",
    email: "",
  });

  // ======================
  // 🔄 LOAD
  // ======================
  const loadEmpresa = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyEmpresa();
      setEmpresa(data);

      // Populate form with current data
      setFormData({
        name: data.name || "",
        cnpj: data.cnpj || "",
        cpf: data.cpf || "",
        endereco: data.endereco || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
        telefone: data.telefone || "",
        email: data.email || "",
      });
    } catch (error: unknown) {
      console.error("Erro ao buscar empresa:", error);
      toast.error("Erro ao buscar dados da empresa");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmpresa();
  }, [loadEmpresa]);

  // ======================
  // 💾 SAVE
  // ======================
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMyEmpresa(formData);
      setEmpresa(updated);
      toast.success("Empresa atualizada com sucesso!");
    } catch (error: unknown) {
      console.error("Erro ao salvar empresa:", error);
      toast.error("Erro ao salvar dados da empresa");
    } finally {
      setSaving(false);
    }
  };

  // ======================
  // 🧱 RENDER
  // ======================
  if (loading) {
    return (
      <div className="flex">
        <NavbarNested />
        <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="flex">
        <NavbarNested />
        <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">
              Nenhuma empresa associada ao usuário.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-semibold">Dados da Empresa</h1>
            <Button
              type="primary"
              className="shadow-md"
              onClick={handleSave}
              loading={saving}
            >
              Salvar Alterações
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Nome */}
              <div className="space-y-1">
                <label className="text-sm font-medium block">
                  Nome da Empresa
                </label>
                <Input
                  placeholder="Ex.: Escritório de Advocacia Silva & Souza"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              {/* CNPJ e CPF */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium block">CNPJ</label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) =>
                      setFormData({ ...formData, cnpj: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium block">CPF</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) =>
                      setFormData({ ...formData, cpf: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-1">
                <label className="text-sm font-medium block">Endereço</label>
                <Input
                  placeholder="Rua, Número, Bairro"
                  value={formData.endereco}
                  onChange={(e) =>
                    setFormData({ ...formData, endereco: e.target.value })
                  }
                />
              </div>

              {/* Cidade, Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium block">Cidade</label>
                  <Input
                    placeholder="São Paulo"
                    value={formData.cidade}
                    onChange={(e) =>
                      setFormData({ ...formData, cidade: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium block">Estado</label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={formData.estado}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estado: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </div>

              {/* Telefone e Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium block">Telefone</label>
                  <Input
                    placeholder="(11) 98765-4321"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium block">E-mail</label>
                  <Input
                    type="email"
                    placeholder="contato@escritorio.com.br"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Info adicional */}
              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Cadastrado em:{" "}
                  {new Date(empresa.criado_em).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
