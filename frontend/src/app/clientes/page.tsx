"use client";

import { useEffect, useState } from "react";
import { getClientes, Cliente, deleteCliente, createCliente, updateCliente } from "../../services/clientes";
import { Button, message } from "antd";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import ClienteDialog from "@/components/dialogs/ClienteDialog";
import { toast } from "sonner";

export default function ClientePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10; // 🔥 Pode até ser dinâmico depois

  const loadClientes = async () => {
    try {
      setLoading(true);
      const res = await getClientes({ page, page_size: pageSize });
      setClientes(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      toast.error("Erro ao buscar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este cliente?")) {
      await deleteCliente(id);
      loadClientes();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, data);
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await createCliente(data);
        toast.success("Cliente criado com sucesso!");
      }

      setOpenDialog(false);
      setEditingCliente(null);
      loadClientes();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast.error("Erro ao salvar cliente");
    }
  };

  const columns: TableColumnsType<Cliente> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "CPF / CNPJ", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    { title: "Tipo", dataIndex: "tipo_display" },
    {
      title: "Ações",
      dataIndex: "acoes",
      render: (_: any, record: Cliente) => (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingCliente(record);
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
          <Button className='shadow-md' onClick={() => setOpenDialog(true)}>
            Criar Cliente
          </Button>
        </div>

        <GenericTable<Cliente>
          columns={columns}
          data={clientes}
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            onChange: (page) => setPage(page),
          }}
        />

        <ClienteDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingCliente(null);
          }}
          onSubmit={handleSubmit}
          cliente={editingCliente}
        />
      </main>
    </div>
  );
}
