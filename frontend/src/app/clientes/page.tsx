"use client";

import { useEffect, useState } from "react";
import { getClientes, Cliente, deleteCliente, createCliente } from "../../services/clientes";
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

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      message.error("Erro ao buscar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este cliente?")) {
      await deleteCliente(id);
      loadClientes();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      await createCliente(data);
      toast.success("Cliente criado com sucesso!");
      setOpenDialog(false);
      loadClientes();
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      toast.error("Erro ao criar cliente");
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
        <Button danger onClick={() => handleDelete(record.id)}>
          Excluir
        </Button>
      ),
    },
  ];

  return (
    <div className="flex">
      {/* 🔳 Navbar */}
      <NavbarNested />

      {/* 🔹 Conteúdo */}
      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        {/* 🔘 Botão Criar */}
        <div className="flex justify-end mb-4">
          <Button color="default" variant="solid" onClick={() => setOpenDialog(true)}>
            Criar Cliente
          </Button>
        </div>

        {/* 🗒️ Tabela */}
        <GenericTable<Cliente> columns={columns} data={clientes} loading={loading} />

        {/* 🪟 Dialog */}
        <ClienteDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
