"use client";

import { useEffect, useState, useCallback } from "react";

import {
  getBancos,
  createBanco,
  updateBanco,
  deleteBanco,
} from "@/services/bancos";

import { Banco, BancoCreate, BancoUpdate } from "@/types/bancos";

import { Button } from "antd";
import type { TableColumnsType } from "antd";
import { toast } from "sonner";

import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import BancoDialog from "@/components/dialogs/BancoDialog";

import { formatCurrencyBR } from "@/lib/formatters";
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
  const loadBancos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBancos({ page_size: 100000 });
      setBancos(res.results);
    } catch (error: unknown) {
      console.error("Erro ao buscar contas bancárias:", error);
      toast.error("Erro ao buscar contas bancárias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBancos();
  }, [loadBancos]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm("Deseja realmente excluir esta conta bancária?")) return;

    try {
      await deleteBanco(id);
      toast.success("Conta bancária excluída com sucesso!");
      loadBancos();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao excluir conta bancária");
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (data: BancoCreate | BancoUpdate) => {
    try {
      if (editingBanco) {
        // UPDATE → pode ser parcial
        await updateBanco(editingBanco.id, data as BancoUpdate);
        toast.success("Conta bancária atualizada com sucesso!");
      } else {
        // CREATE → payload obrigatório
        await createBanco(data as BancoCreate);
        toast.success("Conta bancária criada com sucesso!");
      }

      setOpenDialog(false);
      setEditingBanco(null);
      loadBancos();
    } catch (error: unknown) {
      console.error("Erro ao salvar conta bancária:", error);
      toast.error("Erro ao salvar conta bancária");
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Banco> = [
    {
      title: "Nome",
      dataIndex: "nome",
      width: "15%",
    },
    {
      title: "Descrição",
      dataIndex: "descricao",
      width: "40%",
    },
    {
      title: "Saldo Atual",
      dataIndex: "saldo_atual",
      width: "20%",
      render: (value: number) => formatCurrencyBR(value),
    },
    {
      title: "Ações",
      key: "actions",
      width: "6%",
      render: (_: unknown, record: Banco) => (
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

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Contas Bancárias</h1>

          <Button
            className="shadow-md bg-navy text-white hover:bg-navy/90"
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

        <BancoDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingBanco(null);
            loadBancos(); // Refetch para atualizar mudanças
          }}
          onSubmit={handleSubmit}
          banco={editingBanco}
        />
      </main>
    </div>
  );
}
