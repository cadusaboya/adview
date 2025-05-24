'use client';

import { useEffect, useState } from 'react';
import { getClientes, Cliente, deleteCliente } from '../../../services/clientes';
import { Button, Flex, message } from 'antd';
import GenericTable from '../../../components/imports/GenericTable';
import type { TableColumnsType } from 'antd';
import { NavbarNested } from '../../../components/imports/Navbar/NavbarNested';

export default function ClientePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      message.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm('Deseja realmente excluir este cliente?')) {
      await deleteCliente(id);
      loadClientes();
    }
  };

  const columns: TableColumnsType<Cliente> = [
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'CPF', dataIndex: 'cpf' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Tipo', dataIndex: 'tipo' },
    {
      title: 'Ações',
      dataIndex: 'acoes',
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
        <GenericTable<Cliente>
          columns={columns}
          data={clientes}
        />
      </main>
    </div>
  );
}
