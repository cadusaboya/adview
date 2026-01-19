"use client";

import { useEffect, useState } from "react";
import { Button, message } from "antd";
import { toast } from "sonner";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import FuncionarioDialog from "@/components/dialogs/FuncionarioDialog";
import { FuncionarioProfileDialog } from "@/components/dialogs/FuncionarioProfileDialog";

import {
  getFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
  Fornecedor,
} from "@/services/fornecedores";

export default function FornecedorPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFornecedor, setEditingFornecedor] =
    useState<Fornecedor | null>(null);

  // 🔹 Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadFornecedores = async () => {
    try {
      setLoading(true);
      const res = await getFornecedores({ page, page_size: pageSize });
      setFornecedores(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error("Erro ao buscar fornecedores:", error);
      message.error("Erro ao buscar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFornecedores();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este fornecedor?")) {
      await deleteFornecedor(id);
      toast.success("Fornecedor excluído com sucesso!");
      loadFornecedores();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingFornecedor) {
        await updateFornecedor(editingFornecedor.id, data);
        toast.success("Fornecedor atualizado com sucesso!");
      } else {
        await createFornecedor(data);
        toast.success("Fornecedor criado com sucesso!");
      }

      setOpenDialog(false);
      setEditingFornecedor(null);
      loadFornecedores();
    } catch (error) {
      console.error("Erro ao salvar fornecedor:", error);
      toast.error("Erro ao salvar fornecedor");
    }
  };

  const columns: TableColumnsType<Fornecedor> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "CPF / CNPJ", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Ações",
      render: (_: any, record: Fornecedor) => (
        <div className="flex gap-2">
          {/* 🔹 FINANCEIRO (REUSO TOTAL) */}
          <FuncionarioProfileDialog funcionarioId={record.id}>
            <Button type="default">Financeiro</Button>
          </FuncionarioProfileDialog>

          {/* 🔹 EDITAR */}
          <Button
            onClick={() => {
              setEditingFornecedor(record);
              setOpenDialog(true);
            }}
          >
            Editar
          </Button>

          {/* 🔹 EXCLUIR */}
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
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Fornecedores</h1>

          <Button
            className="shadow-md"
            onClick={() => {
              setEditingFornecedor(null);
              setOpenDialog(true);
            }}
          >
            Criar Fornecedor
          </Button>
        </div>

        <GenericTable<Fornecedor>
          columns={columns}
          data={fornecedores}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (page) => setPage(page),
          }}
        />

        {/* 🔹 DIALOG CRIAR / EDITAR */}
        <FuncionarioDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingFornecedor(null);
          }}
          onSubmit={handleSubmit}
          funcionario={editingFornecedor}
        />
      </main>
    </div>
  );
}
