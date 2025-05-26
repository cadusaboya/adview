"use client";

import { useEffect, useState } from "react";
import { Button, message } from "antd";
import { toast } from "sonner";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import FuncionarioDialog from "@/components/dialogs/FuncionarioDialog";

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
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);

  const loadFornecedores = async () => {
    try {
      setLoading(true);
      const data = await getFornecedores();
      setFornecedores(data);
    } catch (error) {
      console.error("Erro ao buscar fornecedores:", error);
      message.error("Erro ao buscar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFornecedores();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este fornecedor?")) {
      await deleteFornecedor(id);
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
    { title: "CPF", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    { title: "Tipo", dataIndex: "tipo_display" },
    {
      title: "Salário Mensal",
      dataIndex: "salario_mensal",
      render: (valor: any) => (valor ? `R$ ${Number(valor).toFixed(2)}` : "—"),
    },
    {
      title: "Ações",
      dataIndex: "acoes",
      render: (_: any, record: Fornecedor) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingFornecedor(record);
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
        />

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
