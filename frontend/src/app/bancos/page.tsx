"use client";

import { useEffect, useState } from "react";
import {
  getBancos,
  createBanco,
  updateBanco,
  deleteBanco,
  Banco,
} from "@/services/bancos";

import { Button } from "antd";
import { toast } from "sonner";
import type { TableColumnsType } from "antd";

import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import BancoDialog from "@/components/dialogs/BancoDialog";

import { formatCurrencyBR } from "@/lib/formatters";

// ✅ Dropdown reutilizável
import { ActionsDropdown } from "@/components/imports/ActionsDropdown";
import { Pencil, Trash } from "lucide-react";

export default function BancosPage() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);

  // ======================
  // 🔄 LOAD
  // ======================
  const loadBancos = async () => {
    setLoading(true);
    try {
      const res = await getBancos({ page_size: 100000 });
      setBancos(res.results);
    } catch (error) {
      console.error("Erro ao buscar contas bancárias:", error);
      toast.error("Erro ao buscar contas bancárias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBancos();
  }, []);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm("Deseja realmente excluir esta conta bancária?")) return;

    try {
      await deleteBanco(id);
      toast.success("Conta bancária excluída com sucesso!");
      loadBancos();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir conta bancária");
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (data: any) => {
    try {
      if (editingBanco) {
        await updateBanco(editingBanco.id, data);
        toast.success("Conta bancária atualizada com sucesso!");
      } else {
        await createBanco(data);
        toast.success("Conta bancária criada com sucesso!");
      }

      setOpenDialog(false);
      setEditingBanco(null);
      loadBancos();
    } catch (error) {
      console.error("Erro ao salvar conta bancária:", error);
      toast.error("Erro ao salvar conta bancária");
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Banco> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "Descrição", dataIndex: "descricao" },
    {
      title: "Saldo Atual",
      dataIndex: "saldo_atual",
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: "Ações",
      key: "actions",
      render: (_: any, record: Banco) => (
        <ActionsDropdown
          actions={[
            {
              label: "Editar",
              icon: Pencil,
              onClick: () => {
                setEditingBanco(record);
                setOpenDialog(true);
              },
            },
            {
              label: "Excluir",
              icon: Trash,
              danger: true,
              onClick: () => handleDelete(record.id),
            },
          ]}
        />
      ),
    },
  ];

  // ======================
  // 🧱 RENDER
  // ======================
  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Contas Bancárias</h1>

          <Button
            className="shadow-md"
            onClick={() => {
              setEditingBanco(null);
              setOpenDialog(true);
            }}
          >
            Criar Conta Bancária
          </Button>
        </div>

        <GenericTable<Banco>
          columns={columns}
          data={bancos}
          loading={loading}
        />

        {/* 🔹 DIALOG CRIAR / EDITAR */}
        <BancoDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingBanco(null);
          }}
          onSubmit={handleSubmit}
          banco={editingBanco}
        />
      </main>
    </div>
  );
}
