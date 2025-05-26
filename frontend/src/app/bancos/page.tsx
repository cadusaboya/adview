"use client";

import { useEffect, useState } from "react";
import {
  getBancos,
  createBanco,
  updateBanco,
  deleteBanco,
  Banco,
} from "@/services/bancos";
import { Button, message } from "antd";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import { toast } from "sonner";
import BancoDialog from "@/components/dialogs/BancoDialog";

export default function BancosPage() {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);

  const loadBancos = async () => {
    setLoading(true);
    try {
      const res = await getBancos({ page_size: 100000 }); // 👉 força pegar tudo
      setBancos(res.results); // 👈 dados estão aqui
    } catch (error: any) {
      console.error('Erro ao buscar contas bancárias:', error);
      toast.error('Erro ao buscar contas bancárias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBancos();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir esta conta bancária?")) {
      await deleteBanco(id);
      loadBancos();
    }
  };

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

  const columns: TableColumnsType<Banco> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "Descrição", dataIndex: "descricao" },
    {
      title: "Saldo Inicial",
      dataIndex: "saldo_inicial",
      render: (value) => `R$ ${Number(value).toFixed(2)}`,
    },
    {
      title: "Saldo Atual",
      dataIndex: "saldo_atual",
      render: (value) => `R$ ${Number(value).toFixed(2)}`,
    },
    {
      title: "Ações",
      dataIndex: "acoes",
      render: (_: any, record: Banco) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingBanco(record);
              setOpenDialog(true);
            }}
          >
            Editar
          </Button>

          <Button danger onClick={() => handleDelete(record.id)}>
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex">
      <NavbarNested />

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="flex justify-end mb-4">
          <Button
            color="default"
            variant="solid"
            onClick={() => setOpenDialog(true)}
          >
            Criar Conta Bancária
          </Button>
        </div>

        <GenericTable<Banco> columns={columns} data={bancos} loading={loading} />

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
