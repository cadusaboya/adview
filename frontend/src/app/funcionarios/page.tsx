"use client";

import { useEffect, useState } from "react";
import { Button, message, Pagination } from "antd";
import { toast } from "sonner";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import FuncionarioDialog from "@/components/dialogs/FuncionarioDialog";

import {
  getFuncionarios,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  Funcionario,
} from "@/services/funcionarios";

export default function FuncionarioPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null);

  // 🔥 Estado da paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10; // padrão

  const loadFuncionarios = async () => {
    try {
      setLoading(true);
      const res = await getFuncionarios({ page, page_size: pageSize });
      setFuncionarios(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      message.error("Erro ao buscar funcionários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFuncionarios();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este funcionário?")) {
      await deleteFuncionario(id);
      loadFuncionarios();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingFuncionario) {
        await updateFuncionario(editingFuncionario.id, data);
        toast.success("Funcionário atualizado com sucesso!");
      } else {
        await createFuncionario(data);
        toast.success("Funcionário criado com sucesso!");
      }
      setOpenDialog(false);
      setEditingFuncionario(null);
      loadFuncionarios();
    } catch (error) {
      console.error("Erro ao salvar funcionário:", error);
      toast.error("Erro ao salvar funcionário");
    }
  };

  const columns: TableColumnsType<Funcionario> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "CPF", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Salário Mensal",
      dataIndex: "salario_mensal",
      render: (valor: any) => valor ? `R$ ${Number(valor).toFixed(2)}` : "—",
    },
    {
      title: "Ações",
      dataIndex: "acoes",
      render: (_: any, record: Funcionario) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingFuncionario(record);
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
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Funcionários</h1>
          <Button
            color="default"
            className='shadow-md'
            onClick={() => {
              setEditingFuncionario(null);
              setOpenDialog(true);
            }}
          >
            Criar Funcionário
          </Button>
        </div>

        <GenericTable<Funcionario>
          columns={columns}
          data={funcionarios}
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (page) => setPage(page),
           }}
        />
        
        <FuncionarioDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingFuncionario(null);
          }}
          onSubmit={handleSubmit}
          funcionario={editingFuncionario}
        />
      </main>
    </div>
  );
}
